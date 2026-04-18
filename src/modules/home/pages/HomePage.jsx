import { Link } from '@tanstack/react-router';
import { useAuth } from '../../auth/AuthContext.jsx';
import { EmptyState } from '../../shared/components/EmptyState.jsx';

export const HomePage = () => {
  const { isAuthenticated, loginWithDemo } = useAuth();

  return (
    <div className="stack">
      <section className="stack" style={{ gap: 6 }}>
        <h1 className="page-title">AI Interview Simulator</h1>
        <p className="page-subtitle">
          Practice technical interviews with structured scoring and focused feedback. Start an interview flow, run through
          prompts, and complete with a final summary report.
        </p>
      </section>

      {!isAuthenticated ? (
        <section className="panel stack">
          <p className="kicker" style={{ margin: 0 }}>
            Authentication
          </p>
          <strong>Sign in to access interview and coding modes.</strong>
          <p className="muted" style={{ margin: 0 }}>
            This MVP uses a local demo token because Auth0 runtime wiring is not yet present in this repository.
          </p>
          <div>
            <button type="button" onClick={loginWithDemo}>
              Sign In (Demo)
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid two">
        <article className="panel stack">
          <p className="kicker" style={{ margin: 0 }}>
            Interview Mode
          </p>
          <strong>Run a role-based mock interview</strong>
          <p className="muted" style={{ margin: 0 }}>
            Setup role and level, answer by transcript, receive structured feedback, and complete with a summary.
          </p>
          <div>
            <Link className="nav-link" to="/interview/setup">
              Start New Interview
            </Link>
          </div>
        </article>

        <article className="panel stack">
          <p className="kicker" style={{ margin: 0 }}>
            Coding Mode
          </p>
          <strong>Enter coding setup flow</strong>
          <p className="muted" style={{ margin: 0 }}>
            Choose language and problem track. Full coding editor is intentionally out of scope for this phase.
          </p>
          <div>
            <Link className="nav-link" to="/coding/setup">
              Open Coding Setup
            </Link>
          </div>
        </article>
      </section>

      <EmptyState
        title="No session history available yet"
        message="A history endpoint is not currently exposed by the backend contract, so this dashboard only shows quick start actions."
      />
    </div>
  );
};
