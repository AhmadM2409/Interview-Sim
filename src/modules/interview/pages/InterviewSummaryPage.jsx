import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getInterviewSummary } from '../api/interviewApi.js';
import { ErrorState } from '../../shared/components/ErrorState.jsx';
import { LoadingState } from '../../shared/components/LoadingState.jsx';
import { toUiError } from '../../shared/api/client.js';

const formatMetric = (value) => (typeof value === 'number' ? value : 'Unavailable');

export const InterviewSummaryPage = ({ sessionId }) => {
  const { token, isAuthenticated, loginWithDemo } = useAuth();

  const summaryQuery = useQuery({
    queryKey: ['interview-summary', sessionId],
    enabled: isAuthenticated,
    queryFn: () => getInterviewSummary({ token, sessionId }),
    retry: false,
  });

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

      <section className="panel">
        <p className="muted" style={{ margin: 0 }}>
          Technical/communication breakdown values show as "Unavailable" when the backend summary contract does not include
          those fields.
        </p>
      </section>
    </div>
  );
};
