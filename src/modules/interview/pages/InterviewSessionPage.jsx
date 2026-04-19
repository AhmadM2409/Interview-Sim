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
  requestCodingAssistantFeedback,
} from '../api/interviewApi.js';
import { AudioPlayer } from '../components/AudioPlayer.jsx';
import { CodingEditor } from '../components/CodingEditor.jsx';
import { FeedbackCard } from '../components/FeedbackCard.jsx';
import { QuestionCard } from '../components/QuestionCard.jsx';
import { TranscriptionBox } from '../components/TranscriptionBox.jsx';

const isLockError = (error) => error instanceof ApiError && error.status === 409;
const codingQuestionPattern = /\b(code|implement|function|write|algorithm)\b/i;
const codingLanguageOptions = ['javascript', 'typescript', 'python', 'java', 'cpp'];

const inferQuestionType = (question) => {
  if (question?.type === 'coding' || question?.type === 'verbal') {
    return question.type;
  }

  return codingQuestionPattern.test(question?.questionText ?? '') ? 'coding' : 'verbal';
};

const normalizeQuestion = (question) => {
  if (!question) {
    return question;
  }

  const type = inferQuestionType(question);
  const supportedLanguages =
    type === 'coding'
      ? Array.isArray(question.supportedLanguages) && question.supportedLanguages.length > 0
        ? question.supportedLanguages
        : codingLanguageOptions
      : null;

  return {
    ...question,
    type,
    category: question.category ?? (type === 'coding' ? 'coding' : 'background'),
    language: type === 'coding' ? question.language ?? 'javascript' : null,
    supportedLanguages,
  };
};

const buildStarterCode = (language = 'javascript') => {
  switch (language) {
    case 'typescript':
      return [
        'function solve(input: string): string {',
        '  // write your code here',
        "  return input;",
        '}',
      ].join('\n');
    case 'python':
      return [
        'def solve(value):',
        '    # write your code here',
        '    return value',
      ].join('\n');
    case 'java':
      return [
        'class Solution {',
        '  public String solve(String value) {',
        '    // write your code here',
        '    return value;',
        '  }',
        '}',
      ].join('\n');
    case 'cpp':
      return [
        '#include <string>',
        'using namespace std;',
        '',
        'string solve(string value) {',
        '  // write your code here',
        '  return value;',
        '}',
      ].join('\n');
    case 'javascript':
    default:
      return [
        'function solve(value) {',
        '  // write your code here',
        '  return value;',
        '}',
      ].join('\n');
  }
};

const createCodingState = (question) => ({
  code: buildStarterCode(question.language ?? 'javascript'),
  language: question.language ?? 'javascript',
  transcript: '',
  output: '',
  assistantFeedback: null,
  assistantHistory: [],
  assistantAudioSrc: '',
  assistantError: '',
  shouldSpeakAssistant: false,
  lastAssistantSnapshot: '',
  lastAssistantRequestedAt: 0,
});

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
  try {
    const result = window.eval(source);

    return typeof result === 'undefined'
      ? 'Code ran successfully.'
      : formatConsoleValue(result);
  } catch (error) {
    return `Execution failed: ${error?.message ?? 'Unknown error'}`;
  }
};

const buildAssistantSnapshot = ({ code, transcript, language }) =>
  JSON.stringify({
    language,
    code: code.trim().replace(/\s+/g, ' ').slice(-240),
    transcript: transcript.trim().replace(/\s+/g, ' ').slice(-240),
  });

const mapAssistantMessages = (history) =>
  history.slice(-6).map((message) => ({
    role: 'assistant',
    text: message.responseText,
  }));

export const InterviewSessionPage = ({ sessionId, onCompleted }) => {
  const { token, isAuthenticated, loginWithDemo } = useAuth();
  const [transcript, setTranscript] = useState('');
  const [codingStates, setCodingStates] = useState({});
  const [openCodingEditors, setOpenCodingEditors] = useState({});
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

  const updateCodingState = (questionId, updater) => {
    if (!questionId) {
      return;
    }

    setCodingStates((current) => {
      const previous = current[questionId] ?? createCodingState({ questionId, language: 'javascript' });
      return {
        ...current,
        [questionId]: typeof updater === 'function' ? updater(previous) : updater,
      };
    });
  };

  const ensureCodingState = (question) => {
    if (!question?.questionId || question.type !== 'coding') {
      return;
    }

    setCodingStates((current) => {
      if (current[question.questionId]) {
        return current;
      }

      return {
        ...current,
        [question.questionId]: createCodingState(question),
      };
    });
  };

  useEffect(() => {
    if (questionQuery.data) {
      const normalizedQuestion = normalizeQuestion(questionQuery.data);
      setActiveQuestion(normalizedQuestion);
      setAudioSrc('');
      ensureCodingState(normalizedQuestion);
    }
  }, [questionQuery.data]);

  const activeQuestionType = activeQuestion?.type ?? 'verbal';
  const activeCodingState =
    activeQuestion?.type === 'coding' && activeQuestion?.questionId
      ? (codingStates[activeQuestion.questionId] ?? createCodingState(activeQuestion))
      : null;
  const activeQuestionLanguage = activeCodingState?.language ?? activeQuestion?.language ?? 'javascript';
  const activeCode = activeCodingState?.code ?? buildStarterCode(activeQuestionLanguage);
  const activeCodingTranscript = activeCodingState?.transcript ?? '';
  const activeCodeOutput = activeCodingState?.output ?? '';
  const activeAssistantFeedback = activeCodingState?.assistantFeedback ?? null;
  const activeAssistantError = activeCodingState?.assistantError ?? '';
  const activeAssistantAudioSrc = activeCodingState?.assistantAudioSrc ?? '';
  const activeAssistantHistory = activeCodingState?.assistantHistory ?? [];
  const isCodingEditorOpen = activeQuestion?.questionId ? Boolean(openCodingEditors[activeQuestion.questionId]) : false;

  const evaluateMutation = useMutation({
    mutationFn: () =>
      activeQuestionType === 'coding'
        ? evaluateInterviewAnswer({
            token,
            sessionId,
            type: 'coding',
            code: activeCode,
            language: activeQuestionLanguage,
            transcript: activeCodingTranscript.trim(),
            assistantMessages: mapAssistantMessages(activeAssistantHistory),
          })
        : evaluateInterviewAnswer({ token, sessionId, type: 'verbal', transcript: transcript.trim() }),
    onSuccess: (data) => {
      setFeedback(data.scores);
      setNotice(activeQuestionType === 'coding' ? 'Code evaluated successfully.' : 'Answer evaluated successfully.');
    },
  });

  const nextMutation = useMutation({
    mutationFn: () => getNextInterviewQuestion({ token, sessionId }),
    onSuccess: (data) => {
      const normalizedQuestion = normalizeQuestion(data);
      setActiveQuestion(normalizedQuestion);
      setTranscript('');
      setFeedback(null);
      setNotice('Moved to next question.');
      setAudioSrc('');
      ensureCodingState(normalizedQuestion);
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

  const assistantMutation = useMutation({
    mutationFn: ({ questionId, code, transcript: nextTranscript, language, includeAudio, assistantMessages }) =>
      requestCodingAssistantFeedback({
        token,
        sessionId,
        code,
        transcript: nextTranscript,
        language,
        includeAudio,
        assistantMessages,
      }),
    onSuccess: (data, variables) => {
      updateCodingState(variables.questionId, (current) => {
        const nextFeedback = {
          responseText: data.responseText,
          goodSignals: data.goodSignals ?? [],
          missingOrRisky: data.missingOrRisky ?? [],
          questionableAssumptions: data.questionableAssumptions ?? [],
          suggestedNextStep: data.suggestedNextStep,
        };

        return {
          ...current,
          assistantFeedback: nextFeedback,
          assistantHistory: [...current.assistantHistory, nextFeedback].slice(-6),
          assistantAudioSrc: data.audioBase64
            ? `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`
            : '',
          assistantError: '',
          lastAssistantSnapshot: variables.snapshot,
          lastAssistantRequestedAt: Date.now(),
        };
      });
    },
    onError: (error, variables) => {
      updateCodingState(variables.questionId, (current) => ({
        ...current,
        assistantError: toUiError(error),
        lastAssistantRequestedAt: Date.now(),
      }));
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

    updateCodingState(activeQuestion.questionId, (current) => ({
      ...current,
      code: value,
    }));
  };

  const handleCodingTranscriptChange = (value) => {
    if (!activeQuestion?.questionId) {
      return;
    }

    updateCodingState(activeQuestion.questionId, (current) => ({
      ...current,
      transcript: value,
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

    updateCodingState(activeQuestion.questionId, (current) => ({
      ...current,
      output,
    }));
  };

  const handleResetCode = () => {
    if (!activeQuestion?.questionId) {
      return;
    }

    const starterCode = buildStarterCode(activeQuestionLanguage);

    updateCodingState(activeQuestion.questionId, (current) => ({
      ...current,
      code: starterCode,
      output: '',
    }));
  };

  const handleClearCodingTranscript = () => {
    if (!activeQuestion?.questionId) {
      return;
    }

    updateCodingState(activeQuestion.questionId, (current) => ({
      ...current,
      transcript: '',
      assistantFeedback: null,
      assistantAudioSrc: '',
      assistantError: '',
    }));
  };

  const handleLanguageChange = (nextLanguage) => {
    if (!activeQuestion?.questionId) {
      return;
    }

    updateCodingState(activeQuestion.questionId, (current) => {
      const previousStarter = buildStarterCode(current.language);
      const nextStarter = buildStarterCode(nextLanguage);
      const shouldReplaceCode = !current.code.trim() || current.code === previousStarter;

      return {
        ...current,
        language: nextLanguage,
        code: shouldReplaceCode ? nextStarter : current.code,
        output: '',
      };
    });
  };

  const handleToggleAssistantVoice = (checked) => {
    if (!activeQuestion?.questionId) {
      return;
    }

    updateCodingState(activeQuestion.questionId, (current) => ({
      ...current,
      shouldSpeakAssistant: checked,
      assistantAudioSrc: checked ? current.assistantAudioSrc : '',
    }));
  };

  const handleRequestAssistant = async (isManual = false) => {
    if (!activeQuestion?.questionId || activeQuestionType !== 'coding') {
      return;
    }

    const snapshot = buildAssistantSnapshot({
      code: activeCode,
      transcript: activeCodingTranscript,
      language: activeQuestionLanguage,
    });

    if (!isManual && snapshot === activeCodingState?.lastAssistantSnapshot) {
      return;
    }

    updateCodingState(activeQuestion.questionId, (current) => ({
      ...current,
      assistantError: '',
    }));

    try {
      await assistantMutation.mutateAsync({
        questionId: activeQuestion.questionId,
        code: activeCode,
        transcript: activeCodingTranscript.trim(),
        language: activeQuestionLanguage,
        includeAudio: Boolean(activeCodingState?.shouldSpeakAssistant),
        assistantMessages: mapAssistantMessages(activeAssistantHistory),
        snapshot,
      });
    } catch (_error) {
      // mutation state already captures the surfaced UI error
    }
  };

  const handleOpenCodingEnvironment = () => {
    if (!activeQuestion?.questionId) {
      return;
    }

    setOpenCodingEditors((current) => ({
      ...current,
      [activeQuestion.questionId]: true,
    }));
  };

  useEffect(() => {
    if (
      activeQuestionType !== 'coding' ||
      !activeQuestion?.questionId ||
      !isCodingEditorOpen ||
      assistantMutation.isPending
    ) {
      return;
    }

    const trimmedTranscript = activeCodingTranscript.trim();

    if (!trimmedTranscript || trimmedTranscript.length < 24) {
      return;
    }

    const snapshot = buildAssistantSnapshot({
      code: activeCode,
      transcript: activeCodingTranscript,
      language: activeQuestionLanguage,
    });

    if (snapshot === activeCodingState?.lastAssistantSnapshot) {
      return;
    }

    const hasRequestedBefore = Boolean(activeCodingState?.lastAssistantRequestedAt);
    const cooldownRemaining = hasRequestedBefore
      ? Math.max(0, 12000 - (Date.now() - activeCodingState.lastAssistantRequestedAt))
      : 0;
    const timeoutId = window.setTimeout(() => {
      handleRequestAssistant(false).catch(() => {
        // error state is handled in the mutation callback
      });
    }, Math.max(2500, cooldownRemaining));

    return () => window.clearTimeout(timeoutId);
  }, [
    activeAssistantHistory,
    activeCode,
    activeCodingState?.lastAssistantRequestedAt,
    activeCodingState?.lastAssistantSnapshot,
    activeCodingTranscript,
    activeQuestion?.questionId,
    activeQuestionLanguage,
    activeQuestionType,
    assistantMutation.isPending,
    isCodingEditorOpen,
  ]);

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
        isCodingEditorOpen ? (
          <CodingEditor
            code={activeCode}
            language={activeQuestionLanguage}
            languageOptions={activeQuestion?.supportedLanguages ?? codingLanguageOptions}
            output={activeCodeOutput}
            transcript={activeCodingTranscript}
            assistantFeedback={activeAssistantFeedback}
            assistantError={activeAssistantError}
            assistantAudioSrc={activeAssistantAudioSrc}
            disabled={isActionPending}
            isSubmitting={evaluateMutation.isPending}
            isAssistantPending={assistantMutation.isPending}
            shouldSpeakAssistant={Boolean(activeCodingState?.shouldSpeakAssistant)}
            onCodeChange={handleCodeChange}
            onRun={handleRunCode}
            onSubmit={() => handleMutatingAction(() => evaluateMutation.mutateAsync())}
            onClearCode={handleResetCode}
            onTranscriptChange={handleCodingTranscriptChange}
            onClearTranscript={handleClearCodingTranscript}
            onLanguageChange={handleLanguageChange}
            onRequestAssistant={handleRequestAssistant}
            onToggleAssistantVoice={handleToggleAssistantVoice}
          />
        ) : (
          <section className="panel stack">
            <p style={{ margin: 0 }}>
              This question expects code, transcript capture, and live interviewer feedback inside the coding workspace.
            </p>
            <div>
              <button type="button" onClick={handleOpenCodingEnvironment} disabled={isActionPending}>
                Open Coding Environment
              </button>
            </div>
          </section>
        )
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
