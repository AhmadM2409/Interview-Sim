import { Link } from '@tanstack/react-router';
import { useAuth } from '../../auth/AuthContext.jsx';
import { EmptyState } from '../../shared/components/EmptyState.jsx';
import logo from '../../../Gemini_Generated_Image_b1ig67b1ig67b1ig.png';

export const HomePage = () => {
  const { isAuthenticated, loginWithDemo } = useAuth();

  return (
    <div className="stack">
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

      <section className="stack" style={{ gap: 6, alignItems: 'center', textAlign: 'center', width: '100%' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
          <img
            src={logo}
            alt="AI Interview Simulator"
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              objectFit: 'cover',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              background: 'var(--surface-soft)',
            }}
          />
          <h1 className="page-title" style={{ margin: 0 }}>
            AI Interview Simulator
          </h1>
        </div>
        <p className="page-subtitle" style={{ margin: '0 auto', maxWidth: 700 }}>
          Practice technical interviews with structured scoring and focused feedback. Start an interview flow, run through
          prompts, and complete with a final summary report.
        </p>
      </section>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
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
      </div>

      <EmptyState
        title="Start your next attempt"
        message="Session history is available on the interview summary page after completion. Use the shortcuts above to begin a new run."
      />
    </div>
  );
};
