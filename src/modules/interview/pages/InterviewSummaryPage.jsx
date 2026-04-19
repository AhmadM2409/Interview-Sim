import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getInterviewHistory, getInterviewSummary } from '../api/interviewApi.js';
import { ErrorState } from '../../shared/components/ErrorState.jsx';
import { LoadingState } from '../../shared/components/LoadingState.jsx';
import { toUiError } from '../../shared/api/client.js';

const formatMetric = (value) => (typeof value === 'number' ? value : 'Unavailable');

const formatDateTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

export const InterviewSummaryPage = ({ sessionId }) => {
  const { token, isAuthenticated, loginWithGoogle, isLoading, getToken } = useAuth();

  const summaryQuery = useQuery({
    queryKey: ['interview-summary', sessionId],
    enabled: isAuthenticated,
    queryFn: async () => {
      const authToken = await getToken();
      return getInterviewSummary({ token: authToken, sessionId });
    },
    retry: false,
  });

  const historyQuery = useQuery({
    queryKey: ['interview-history'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const authToken = await getToken();
      return getInterviewHistory({ token: authToken });
    },
    retry: false,
  });

  if (!isAuthenticated) {
    return (
      <section className="panel stack">
        <strong>You need to sign in first.</strong>
        <p className="muted" style={{ margin: 0 }}>
          Sign in with your preferred method to view your interview results.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
          <button type="button" onClick={loginWithGoogle} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Sign In with Google'}
          </button>
        </div>
      </section>
    );
  }

  if (summaryQuery.isPending) {
    return <LoadingState title="Loading summary" message="Pulling the latest final report..." />;
  }

  if (summaryQuery.isError) {
    return (
      <ErrorState
        title="Could not load summary"
        message={toUiError(summaryQuery.error)}
        onRetry={() => summaryQuery.refetch()}
      />
    );
  }

  const summary = summaryQuery.data.summary;
  const sessions = historyQuery.data?.sessions ?? [];

  return (
    <div className="stack">
      <section className="stack" style={{ gap: 6 }}>
        <h1 className="page-title">Interview Summary</h1>
        <p className="page-subtitle">Session ID: {sessionId}</p>
      </section>

      <section className="panel stack">
        <p className="kicker" style={{ margin: 0 }}>
          Final Score
        </p>
        <strong className="score">{summary.overallScore}</strong>
      </section>

      <section className="metric-grid">
        <article className="metric">
          <p className="kicker" style={{ marginBottom: 6 }}>
            Technical Breakdown
          </p>
          <strong>{formatMetric(summary.technicalScore)}</strong>
        </article>

        <article className="metric">
          <p className="kicker" style={{ marginBottom: 6 }}>
            Communication Breakdown
          </p>
          <strong>{formatMetric(summary.communicationScore)}</strong>
        </article>

        <article className="metric">
          <p className="kicker" style={{ marginBottom: 6 }}>
            Status
          </p>
          <strong>{summaryQuery.data.status}</strong>
        </article>
      </section>

      {summary.feedbackSummary ? (
        <section className="panel">
          <p className="kicker" style={{ marginTop: 0 }}>
            Feedback Summary
          </p>
          <p style={{ margin: 0 }}>{summary.feedbackSummary}</p>
        </section>
      ) : null}

      <section className="grid two">
        <article className="panel stack">
          <p className="kicker" style={{ margin: 0 }}>
            Strengths
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summary.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel stack">
          <p className="kicker" style={{ margin: 0 }}>
            Improvements
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summary.improvements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="panel stack">
        <p className="kicker" style={{ margin: 0 }}>
          Previous Attempts
        </p>

        {historyQuery.isPending ? <p className="muted" style={{ margin: 0 }}>Loading previous attempts...</p> : null}

        {historyQuery.isError ? (
          <p className="muted" style={{ margin: 0 }}>
            Unable to load previous attempts right now.
          </p>
        ) : null}

        {!historyQuery.isPending && !historyQuery.isError && sessions.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No previous attempts found for this account yet.
          </p>
        ) : null}

        {!historyQuery.isPending && !historyQuery.isError && sessions.length > 0 ? (
          <div className="stack" style={{ gap: 10 }}>
            {sessions.map((item) => (
              <article
                key={item.sessionId}
                className="metric"
                style={{
                  borderColor: item.sessionId === sessionId ? 'var(--brand-strong)' : 'var(--border)',
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{item.role}</strong>
                  <span className="muted">{formatDateTime(item.createdAt)}</span>
                </div>
                <div className="row">
                  <span className="badge">{item.status}</span>
                  <span className="muted">Score: {typeof item.finalScore === 'number' ? item.finalScore : 'N/A'}</span>
                  {item.sessionId === sessionId ? <span className="muted">Current session</span> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
};
