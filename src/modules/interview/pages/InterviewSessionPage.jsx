import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ErrorState } from '../../shared/components/ErrorState.jsx';
import { LoadingState } from '../../shared/components/LoadingState.jsx';
import { ApiError, toUiError } from '../../shared/api/client.js';
import {
  completeInterviewSession,
  evaluateInterviewAnswer,
  getCurrentInterviewQuestion,
  getCurrentQuestionAudio,
  getNextInterviewQuestion,
} from '../api/interviewApi.js';
import { AudioPlayer } from '../components/AudioPlayer.jsx';
import { CodingWorkspace } from '../components/CodingWorkspace.jsx';
import { FeedbackCard } from '../components/FeedbackCard.jsx';
import { QuestionCard } from '../components/QuestionCard.jsx';
import { TranscriptionBox } from '../components/TranscriptionBox.jsx';

const isLockError = (error) => error instanceof ApiError && error.status === 409;
const buildStarterCode = (language = 'javascript') => {
  if (language === 'javascript') {
    return [
      'function solve(input) {',
      '  // Write your solution here.',
      '  return input;',
      '}',
      '',
      "console.log(solve('example'));",
    ].join('\n');
  }

  return '// Write your solution here.';
};

const formatConsoleValue = (value) => {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
};

const runJavaScriptSnippet = (source) => {
  const outputLines = [];
  const runnerConsole = {
    log: (...values) => outputLines.push(values.map(formatConsoleValue).join(' ')),
    error: (...values) => outputLines.push(values.map(formatConsoleValue).join(' ')),
    warn: (...values) => outputLines.push(values.map(formatConsoleValue).join(' ')),
  };

  try {
    const result = new Function('console', `"use strict";\n${source}`)(runnerConsole);

    if (typeof result !== 'undefined') {
      outputLines.push(formatConsoleValue(result));
    }

    return outputLines.length > 0
      ? outputLines.join('\n')
      : 'Code ran successfully with no console output.';
  } catch (error) {
    return `Execution failed: ${error?.message ?? 'Unknown error'}`;
  }
};

export const InterviewSessionPage = ({ sessionId, onCompleted }) => {
  const { token, isAuthenticated, loginWithDemo } = useAuth();
  const [transcript, setTranscript] = useState('');
  const [codeDrafts, setCodeDrafts] = useState({});
  const [codeOutputs, setCodeOutputs] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [audioSrc, setAudioSrc] = useState('');

  const questionQuery = useQuery({
    queryKey: ['interview-question', sessionId],
    enabled: isAuthenticated,
    queryFn: () => getCurrentInterviewQuestion({ token, sessionId }),
    retry: false,
  });

  useEffect(() => {
    if (questionQuery.data) {
      setActiveQuestion(questionQuery.data);
      setAudioSrc('');
      if (questionQuery.data.type === 'coding') {
        setCodeDrafts((current) => {
          if (current[questionQuery.data.questionId]) {
            return current;
          }

          return {
            ...current,
            [questionQuery.data.questionId]: buildStarterCode(questionQuery.data.language ?? 'javascript'),
          };
        });
      }
    }
  }, [questionQuery.data]);

  const activeQuestionType = activeQuestion?.type ?? 'verbal';
  const activeQuestionLanguage = activeQuestion?.language ?? 'javascript';
  const activeCode = activeQuestion?.questionId
    ? (codeDrafts[activeQuestion.questionId] ?? buildStarterCode(activeQuestionLanguage))
    : buildStarterCode(activeQuestionLanguage);
  const activeCodeOutput = activeQuestion?.questionId ? (codeOutputs[activeQuestion.questionId] ?? '') : '';

  const evaluateMutation = useMutation({
    mutationFn: () =>
      activeQuestionType === 'coding'
        ? evaluateInterviewAnswer({
            token,
            sessionId,
            code: activeCode,
            language: activeQuestionLanguage,
          })
        : evaluateInterviewAnswer({ token, sessionId, transcript: transcript.trim() }),
    onSuccess: (data) => {
      setFeedback(data.scores);
      setNotice(activeQuestionType === 'coding' ? 'Code evaluated successfully.' : 'Answer evaluated successfully.');
    },
  });

  const nextMutation = useMutation({
    mutationFn: () => getNextInterviewQuestion({ token, sessionId }),
    onSuccess: (data) => {
      setActiveQuestion(data);
      setTranscript('');
      setFeedback(null);
      setNotice('Moved to next question.');
      if (data.type === 'coding') {
        setCodeDrafts((current) => ({
          ...current,
          [data.questionId]: current[data.questionId] ?? buildStarterCode(data.language ?? 'javascript'),
        }));
      }
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completeInterviewSession({ token, sessionId }),
    onSuccess: () => {
      onCompleted(sessionId);
    },
  });

  const audioMutation = useMutation({
    mutationFn: () => getCurrentQuestionAudio({ token, sessionId }),
    onSuccess: (data) => {
      setAudioSrc(`data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`);
      setNotice('Question audio is ready.');
    },
  });

  const isActionPending = useMemo(
    () =>
      evaluateMutation.isPending ||
      nextMutation.isPending ||
      completeMutation.isPending ||
      audioMutation.isPending,
    [audioMutation.isPending, evaluateMutation.isPending, nextMutation.isPending, completeMutation.isPending],
  );

  const handleMutatingAction = async (fn) => {
    if (isActionPending) {
      return;
    }

    setActionError('');
    setNotice('');

    try {
      await fn();
    } catch (error) {
      if (isLockError(error)) {
        setNotice('Another request is already being processed. Ignoring duplicate action.');
        return;
      }

      setActionError(toUiError(error));
    }
  };

  const handleAudioRequest = async () => {
    if (isActionPending) {
      return;
    }

    setActionError('');
    setNotice('');

    try {
      await audioMutation.mutateAsync();
    } catch (_error) {
      // AudioPlayer renders the current audio-specific error state.
    }
  };

  const handleCodeChange = (value) => {
    if (!activeQuestion?.questionId) {
      return;
    }

    setCodeDrafts((current) => ({
      ...current,
      [activeQuestion.questionId]: value,
    }));
  };

  const handleRunCode = () => {
    if (!activeQuestion?.questionId) {
      return;
    }

    const output =
      activeQuestionLanguage === 'javascript'
        ? runJavaScriptSnippet(activeCode)
        : `Execution is only available for JavaScript in this MVP. Current language: ${activeQuestionLanguage}.`;

    setCodeOutputs((current) => ({
      ...current,
      [activeQuestion.questionId]: output,
    }));
  };

  const handleResetCode = () => {
    if (!activeQuestion?.questionId) {
      return;
    }

    const starterCode = buildStarterCode(activeQuestionLanguage);

    setCodeDrafts((current) => ({
      ...current,
      [activeQuestion.questionId]: starterCode,
    }));
    setCodeOutputs((current) => ({
      ...current,
      [activeQuestion.questionId]: '',
    }));
  };

  if (!isAuthenticated) {
    return (
      <section className="panel stack">
        <strong>You need to sign in first.</strong>
        <div>
          <button type="button" onClick={loginWithDemo}>
            Sign In (Demo)
          </button>
        </div>
      </section>
    );
  }

  if (questionQuery.isPending && !activeQuestion) {
    return <LoadingState title="Loading interview session" message="Fetching your current question..." />;
  }

  if (questionQuery.isError && !activeQuestion) {
    return (
      <ErrorState
        title="Could not load current question"
        message={toUiError(questionQuery.error)}
        onRetry={() => questionQuery.refetch()}
      />
    );
  }

  return (
    <div className="stack">
      <section className="stack" style={{ gap: 6 }}>
        <h1 className="page-title">Interview Session</h1>
        <p className="page-subtitle">Session ID: {sessionId}</p>
      </section>

      {notice ? <div className="alert warning">{notice}</div> : null}
      {actionError ? <div className="alert">{actionError}</div> : null}

      <QuestionCard
        question={activeQuestion?.questionText ?? 'Question unavailable'}
        order={activeQuestion?.order ?? 1}
        type={activeQuestionType}
        language={activeQuestionType === 'coding' ? activeQuestionLanguage : null}
      />
      <AudioPlayer
        hasQuestionText={Boolean(activeQuestion?.questionText)}
        disabled={isActionPending}
        audioSrc={audioSrc}
        isLoading={audioMutation.isPending}
        errorMessage={audioMutation.isError ? toUiError(audioMutation.error) : ''}
        onPlayRequested={handleAudioRequest}
      />

      {activeQuestionType === 'coding' ? (
        <CodingWorkspace
          code={activeCode}
          language={activeQuestionLanguage}
          output={activeCodeOutput}
          disabled={isActionPending}
          isSubmitting={evaluateMutation.isPending}
          onCodeChange={handleCodeChange}
          onRun={handleRunCode}
          onSubmit={() => handleMutatingAction(() => evaluateMutation.mutateAsync())}
          onClear={handleResetCode}
        />
      ) : (
        <TranscriptionBox
          transcript={transcript}
          setTranscript={setTranscript}
          onSubmit={() => handleMutatingAction(() => evaluateMutation.mutateAsync())}
          onClear={() => setTranscript('')}
          disabled={isActionPending}
          isSubmitting={evaluateMutation.isPending}
        />
      )}

      <FeedbackCard feedback={feedback} />

      <section className="panel row">
        <button
          type="button"
          className="button-secondary"
          onClick={() => handleMutatingAction(() => nextMutation.mutateAsync())}
          disabled={isActionPending}
        >
          {nextMutation.isPending ? 'Loading next question...' : 'Next Question'}
        </button>

        <button
          type="button"
          className="button-danger"
          onClick={() => handleMutatingAction(() => completeMutation.mutateAsync())}
          disabled={isActionPending}
        >
          {completeMutation.isPending ? 'Completing...' : 'Complete Interview'}
        </button>
      </section>
    </div>
  );
};
