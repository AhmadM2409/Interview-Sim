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
import { CodingEditor } from '../components/CodingEditor.jsx';
import { FeedbackCard } from '../components/FeedbackCard.jsx';
import { QuestionCard } from '../components/QuestionCard.jsx';
import { TranscriptionBox } from '../components/TranscriptionBox.jsx';

const isLockError = (error) => error instanceof ApiError && error.status === 409;
const codingQuestionPattern = /\b(code|implement|function|write|algorithm)\b/i;
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

  return {
    ...question,
    type,
    language: type === 'coding' ? question.language ?? 'javascript' : null,
  };
};

const buildStarterCode = (language = 'javascript') => {
  if (language === 'javascript') {
    return [
      'function solve() {',
      '  // write your code here',
      '}',
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
  try {
    const result = window.eval(source);

    return typeof result === 'undefined'
      ? 'Code ran successfully.'
      : formatConsoleValue(result);
  } catch (error) {
    return `Execution failed: ${error?.message ?? 'Unknown error'}`;
  }
};

export const InterviewSessionPage = ({ sessionId, onCompleted }) => {
  const { token, isAuthenticated, loginWithGoogle, isLoading, getToken } = useAuth();
  const [transcript, setTranscript] = useState('');
  const [codeDrafts, setCodeDrafts] = useState({});
  const [codeOutputs, setCodeOutputs] = useState({});
  const [openCodingEditors, setOpenCodingEditors] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [audioSrc, setAudioSrc] = useState('');

  const questionQuery = useQuery({
    queryKey: ['interview-question', sessionId],
    enabled: isAuthenticated,
    queryFn: async () => {
      const authToken = await getToken();
      return getCurrentInterviewQuestion({ token: authToken, sessionId });
    },
    retry: false,
  });

  useEffect(() => {
    if (questionQuery.data) {
      const normalizedQuestion = normalizeQuestion(questionQuery.data);
      setActiveQuestion(normalizedQuestion);
      setAudioSrc('');
      if (normalizedQuestion.type === 'coding') {
        setCodeDrafts((current) => {
          if (current[normalizedQuestion.questionId]) {
            return current;
          }

          return {
            ...current,
            [normalizedQuestion.questionId]: buildStarterCode(normalizedQuestion.language ?? 'javascript'),
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
    mutationFn: async () => {
      const authToken = await getToken();
      return activeQuestionType === 'coding'
        ? evaluateInterviewAnswer({
            token: authToken,
            sessionId,
            type: 'coding',
            code: activeCode,
            language: activeQuestionLanguage,
          })
        : evaluateInterviewAnswer({ token: authToken, sessionId, type: 'verbal', transcript: transcript.trim() });
    },
    onSuccess: (data) => {
      setFeedback(data.scores);
      setNotice(activeQuestionType === 'coding' ? 'Code evaluated successfully.' : 'Answer evaluated successfully.');
    },
  });

  const nextMutation = useMutation({
    mutationFn: async () => {
      const authToken = await getToken();
      return getNextInterviewQuestion({ token: authToken, sessionId });
    },
    onSuccess: (data) => {
      const normalizedQuestion = normalizeQuestion(data);
      setActiveQuestion(normalizedQuestion);
      setTranscript('');
      setFeedback(null);
      setNotice('Moved to next question.');
      if (normalizedQuestion.type === 'coding') {
        setCodeDrafts((current) => ({
          ...current,
          [normalizedQuestion.questionId]:
            current[normalizedQuestion.questionId] ?? buildStarterCode(normalizedQuestion.language ?? 'javascript'),
        }));
      }
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const authToken = await getToken();
      return completeInterviewSession({ token: authToken, sessionId });
    },
    onSuccess: () => {
      onCompleted(sessionId);
    },
  });

  const audioMutation = useMutation({
    mutationFn: async () => {
      const authToken = await getToken();
      return getCurrentQuestionAudio({ token: authToken, sessionId });
    },
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

  const handleOpenCodingEnvironment = () => {
    if (!activeQuestion?.questionId) {
      return;
    }

    setOpenCodingEditors((current) => ({
      ...current,
      [activeQuestion.questionId]: true,
    }));
  };

  const isCodingEditorOpen = activeQuestion?.questionId ? Boolean(openCodingEditors[activeQuestion.questionId]) : false;

  if (!isAuthenticated) {
    return (
      <section className="panel stack">
        <strong>You need to sign in first.</strong>
        <p className="muted" style={{ margin: 0 }}>
          Sign in with your preferred method to continue.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
          <button type="button" onClick={loginWithGoogle} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Sign In with Google'}
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
            output={activeCodeOutput}
            disabled={isActionPending}
            isSubmitting={evaluateMutation.isPending}
            onCodeChange={handleCodeChange}
            onRun={handleRunCode}
            onSubmit={() => handleMutatingAction(() => evaluateMutation.mutateAsync())}
            onClear={handleResetCode}
          />
        ) : (
          <section className="panel stack">
            <p style={{ margin: 0 }}>
              This question expects code, so the transcript box is replaced with an editor and console.
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
