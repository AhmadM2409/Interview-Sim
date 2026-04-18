import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import { HomePage } from '../modules/home/pages/HomePage.jsx';
import { InterviewSetupPage } from '../modules/interview/pages/InterviewSetupPage.jsx';
import { InterviewSessionPage } from '../modules/interview/pages/InterviewSessionPage.jsx';
import { InterviewSummaryPage } from '../modules/interview/pages/InterviewSummaryPage.jsx';
import { CodingSetupPage } from '../modules/coding/pages/CodingSetupPage.jsx';
import { useAuth } from '../modules/auth/AuthContext.jsx';

const RootLayout = () => {
  const { isAuthenticated, loginWithDemo, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="brand-title">
            AI Interview Simulator
          </Link>

          <nav className="nav-links" aria-label="Primary">
            <Link className="nav-link" to="/interview/setup">
              Interview Setup
            </Link>
            <Link className="nav-link" to="/coding/setup">
              Coding Setup
            </Link>
          </nav>

          <div className="auth-actions">
            {isAuthenticated ? (
              <button type="button" className="button-secondary" onClick={logout}>
                Sign Out
              </button>
            ) : (
              <button type="button" onClick={loginWithDemo}>
                Sign In (Demo)
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
};

const InterviewSetupRouteComponent = () => {
  const navigate = useNavigate();

  return (
    <InterviewSetupPage
      onSessionCreated={(sessionId) => {
        navigate({ to: '/interview/session/$sessionId', params: { sessionId } });
      }}
    />
  );
};

const InterviewSessionRouteComponent = () => {
  const { sessionId } = useParams({ from: '/interview/session/$sessionId' });
  const navigate = useNavigate();

  return (
    <InterviewSessionPage
      sessionId={sessionId}
      onCompleted={(completedSessionId) => {
        navigate({ to: '/interview/summary/$sessionId', params: { sessionId: completedSessionId } });
      }}
    />
  );
};

const InterviewSummaryRouteComponent = () => {
  const { sessionId } = useParams({ from: '/interview/summary/$sessionId' });
  return <InterviewSummaryPage sessionId={sessionId} />;
};

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const interviewSetupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/interview/setup',
  component: InterviewSetupRouteComponent,
});

const interviewSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/interview/session/$sessionId',
  component: InterviewSessionRouteComponent,
});

const interviewSummaryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/interview/summary/$sessionId',
  component: InterviewSummaryRouteComponent,
});

const codingSetupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/coding/setup',
  component: CodingSetupPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  interviewSetupRoute,
  interviewSessionRoute,
  interviewSummaryRoute,
  codingSetupRoute,
]);

const router = createRouter({ routeTree });

export const AppRouterProvider = () => <RouterProvider router={router} />;
