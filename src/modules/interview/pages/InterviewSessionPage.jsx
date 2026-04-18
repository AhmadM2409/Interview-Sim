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
  getNextInterviewQuestion,
} from '../api/interviewApi.js';
import { AudioPlayer } from '../components/AudioPlayer.jsx';
import { FeedbackCard } from '../components/FeedbackCard.jsx';
import { QuestionCard } from '../components/QuestionCard.jsx';
import { TranscriptionBox } from '../components/TranscriptionBox.jsx';

const isLockError = (error) => error instanceof ApiError && error.status === 409;

export const InterviewSessionPage = ({ sessionId, onCompleted }) => {
  const { token, isAuthenticated, loginWithDemo } = useAuth();
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const questionQuery = useQuery({
    queryKey: ['interview-question', sessionId],
    enabled: isAuthenticated,
    queryFn: () => getCurrentInterviewQuestion({ token, sessionId }),
    retry: false,
  });

  useEffect(() => {
    if (questionQuery.data) {
      setActiveQuestion(questionQuery.data);
    }
  }, [questionQuery.data]);

  const evaluateMutation = useMutation({
    mutationFn: () => evaluateInterviewAnswer({ token, sessionId, transcript: transcript.trim() }),
    onSuccess: (data) => {
      setFeedback(data.scores);
      setNotice('Answer evaluated successfully.');
    },
  });

  const nextMutation = useMutation({
    mutationFn: () => getNextInterviewQuestion({ token, sessionId }),
    onSuccess: (data) => {
      setActiveQuestion(data);
      setTranscript('');
      setFeedback(null);
      setNotice('Moved to next question.');
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completeInterviewSession({ token, sessionId }),
    onSuccess: () => {
      onCompleted(sessionId);
    },
  });

  const isActionPending = useMemo(
    () => evaluateMutation.isPending || nextMutation.isPending || completeMutation.isPending,
    [evaluateMutation.isPending, nextMutation.isPending, completeMutation.isPending],
  );

  const handleMutatingAction = async (fn) => {
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

      <QuestionCard question={activeQuestion?.questionText ?? 'Question unavailable'} order={activeQuestion?.order ?? 1} />
      <AudioPlayer text={activeQuestion?.questionText ?? ''} disabled={isActionPending} />

      <TranscriptionBox
        transcript={transcript}
        setTranscript={setTranscript}
        onSubmit={() => handleMutatingAction(() => evaluateMutation.mutateAsync())}
        onClear={() => setTranscript('')}
        disabled={isActionPending}
        isSubmitting={evaluateMutation.isPending}
      />

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
