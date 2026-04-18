import { useCallback, useEffect, useRef, useState } from 'react';
import { answerFn } from '../api/answer';
import { completeFn } from '../api/complete';
import { evaluateFn } from '../api/evaluate';
import { initInterviewFn } from '../api/init';
import { sttFn } from '../api/stt';
import { ttsFn } from '../api/tts';
import { INITIAL_ENGINE_STATE, applyTransition } from '../state/machine';
import type { EngineState, InitResult, InterviewPhase } from '../types';

interface UseInterviewEngineOptions {
  sessionId: string;
  jobRole: string;
  userId: string;
}

interface UseInterviewEngineReturn {
  state: EngineState;
  // Actions exposed to UI
  startInterview: () => Promise<void>;
  continueFromDegraded: () => Promise<void>;
  restartFromError: () => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  confirmTranscript: () => Promise<void>;
  retryAnswer: () => void;
  // Mic/audio refs for UI wiring
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export function useInterviewEngine({
  sessionId,
  jobRole,
  userId,
}: UseInterviewEngineOptions): UseInterviewEngineReturn {
  const [state, setState] = useState<EngineState>(() => ({
    ...INITIAL_ENGINE_STATE,
    sessionId,
  }));

  const questionsRef = useRef<Array<{ question_index: number; question_text: string }>>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const transition = useCallback(
    (to: InterviewPhase, patch: Partial<EngineState> = {}) => {
      setState((prev) => applyTransition(prev, to, patch));
    },
    [],
  );

  const setError = useCallback((message: string) => {
    setState((prev) => {
      try {
        return applyTransition(prev, 'ERROR', { error: message });
      } catch {
        return { ...prev, phase: 'ERROR', error: message };
      }
    });
  }, []);

  // ── Resume from DB on mount (TDD-07) ────────────────────────────────────────

  useEffect(() => {
    const resume = async () => {
      try {
        // init is idempotent — returns existing questions + resume pointer if already started
        const result = await initInterviewFn({
          data: { sessionId, jobRole, userId },
        });

        questionsRef.current = result.questions;

        // activeQuestionIndex = -1 means all answered (session should be completed)
        const resumeIndex = result.activeQuestionIndex >= 0 ? result.activeQuestionIndex : 0;

        setState((prev) => ({
          ...prev,
          totalQuestions: result.questions.length,
          currentQuestionIndex: resumeIndex,
          isDegraded: result.isDegraded,
        }));
      } catch {
        // Session not yet initialized or not found — stay IDLE, wait for startInterview()
      }
    };

    resume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Play audio helper ────────────────────────────────────────────────────────

  const playQuestionAudio = useCallback(
    async (questionText: string, questionIndex: number) => {
      transition('PLAYING_AUDIO', {
        currentQuestionText: questionText,
        currentQuestionIndex: questionIndex,
        audioUrl: null,
        isPlaying: true,
      });

      try {
        const ttsResult = await ttsFn({ data: { text: questionText } });
        const binaryStr = atob(ttsResult.audioBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);

        setState((prev) => ({ ...prev, audioUrl: url }));

        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.onended = () => {
            setState((prev) => ({ ...prev, isPlaying: false }));
            transition('AWAITING_MIC');
          };
          audioRef.current.onerror = () => {
            // Fall back to AWAITING_MIC even if audio fails
            setState((prev) => ({ ...prev, isPlaying: false }));
            transition('AWAITING_MIC');
          };
          await audioRef.current.play().catch(() => {
            // Autoplay blocked — still move to AWAITING_MIC
            setState((prev) => ({ ...prev, isPlaying: false }));
            transition('AWAITING_MIC');
          });
        } else {
          // No audio element — degrade gracefully
          setState((prev) => ({ ...prev, isPlaying: false }));
          transition('AWAITING_MIC');
        }
      } catch (err) {
        // TTS failure is non-fatal: show text, skip audio
        setState((prev) => ({ ...prev, isPlaying: false, isDegraded: true }));
        transition('AWAITING_MIC');
      }
    },
    [transition],
  );

  // ── Public actions ───────────────────────────────────────────────────────────

  const startInterview = useCallback(async () => {
    try {
      transition('FETCHING_CONTEXT');

      const result: InitResult = await initInterviewFn({
        data: { sessionId, jobRole, userId },
      });

      questionsRef.current = result.questions;

      setState((prev) => ({
        ...prev,
        totalQuestions: result.questions.length,
        currentQuestionIndex: 0,
        isDegraded: result.isDegraded,
      }));

      if (result.isDegraded) {
        // Pause at DEGRADED — user confirms before audio starts
        transition('DEGRADED', { isDegraded: true });
        return;
      }

      const first = result.questions[0];
      if (!first) throw new Error('No questions generated');

      await playQuestionAudio(first.question_text, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start interview');
    }
  }, [sessionId, jobRole, userId, transition, setError, playQuestionAudio]);

  const startRecording = useCallback(() => {
    transition('RECORDING', { isRecording: true });

    chunksRef.current = [];

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.start();
      })
      .catch((err) => {
        setError(`Microphone access denied: ${err instanceof Error ? err.message : 'unknown'}`);
      });
  }, [transition, setError]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

      // Stop all mic tracks
      recorder.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;

      try {
        transition('PROCESSING_STT', { isRecording: false });

        // Convert blob to base64
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const audioBase64 = btoa(binary);

        const sttResult = await sttFn({ data: { audioBase64, mimeType: 'audio/webm' } });

        transition('REVIEWING_TRANSCRIPT', {
          transcriptPreview: sttResult.transcript,
        });
      } catch (err) {
        setError(`STT failed: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    };

    recorder.stop();
  }, [transition, setError]);

  const confirmTranscript = useCallback(async () => {
    const transcript = state.transcriptPreview;
    const questionIndex = state.currentQuestionIndex;
    const question = questionsRef.current[questionIndex];

    if (!transcript || !question) {
      setError('No transcript to confirm');
      return;
    }

    try {
      transition('EVALUATING');

      // Write answer (atomic); conflict:true means already written — both paths proceed to evaluate
      await answerFn({
        data: { sessionId, questionIndex, answerText: transcript, userId },
      });

      // Evaluate answer
      const evalResult = await evaluateFn({
        data: { sessionId, questionIndex, userId },
      });

      setState((prev) => ({
        ...prev,
        scores: [
          ...prev.scores,
          { index: questionIndex, score: evalResult.score, feedback: evalResult.feedback },
        ],
      }));

      const nextIndex = questionIndex + 1;
      const nextQuestion = questionsRef.current[nextIndex];

      if (nextQuestion) {
        setState((prev) => ({ ...prev, currentQuestionIndex: nextIndex }));
        await playQuestionAudio(nextQuestion.question_text, nextIndex);
      } else {
        // All questions answered — complete session
        transition('COMPLETING');

        const completeResult = await completeFn({ data: { sessionId, userId } });

        setState((prev) => ({
          ...prev,
          finalScore: completeResult.totalScore,
          summaryFeedback: completeResult.summaryFeedback,
          isDegraded: completeResult.isDegraded,
        }));

        transition('FINISHED');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    }
  }, [
    state.transcriptPreview,
    state.currentQuestionIndex,
    sessionId,
    userId,
    transition,
    setError,
    playQuestionAudio,
  ]);

  const continueFromDegraded = useCallback(async () => {
    const idx = state.currentQuestionIndex;
    const question = questionsRef.current[idx];
    if (!question) return;
    await playQuestionAudio(question.question_text, idx);
  }, [state.currentQuestionIndex, playQuestionAudio]);

  const retryAnswer = useCallback(() => {
    // REVIEWING_TRANSCRIPT → AWAITING_MIC
    try {
      transition('AWAITING_MIC', { transcriptPreview: null });
    } catch {
      setError('Cannot retry from current state');
    }
  }, [transition, setError]);

  /** Reset from ERROR → IDLE, then restart the interview */
  const restartFromError = useCallback(async () => {
    // Force reset (ERROR → IDLE is a valid machine transition)
    setState((prev) => ({ ...prev, phase: 'IDLE', error: null }));
    // Give React one tick to commit the state, then start
    await new Promise((r) => setTimeout(r, 0));
    await startInterview();
  }, [startInterview]);

  return {
    state,
    startInterview,
    continueFromDegraded,
    restartFromError,
    startRecording,
    stopRecording,
    confirmTranscript,
    retryAnswer,
    audioRef,
  };
}
