import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { createInterviewSession } from '../api/interviewApi.js';
import { InterviewConfigForm } from '../components/InterviewConfigForm.jsx';
import { toUiError } from '../../shared/api/client.js';

export const InterviewSetupPage = ({ onSessionCreated }) => {
  const { token, isAuthenticated, loginWithGoogle, loginWithAuth0, isLoading, getToken } = useAuth();

  const createSessionMutation = useMutation({
    mutationFn: async ({ role, level }) => {
      const authToken = await getToken();
      return createInterviewSession({ token: authToken, role, level });
    },
    onSuccess: (data) => {
      onSessionCreated(data.sessionId);
    },
  });

  const submit = async (values) => {
    await createSessionMutation.mutateAsync(values);
  };

  return (
    <div className="stack">
      <section className="stack" style={{ gap: 6 }}>
        <h1 className="page-title">Interview Setup</h1>
        <p className="page-subtitle">Select your target role and start a live practice session.</p>
      </section>

      {!isAuthenticated ? (
        <section className="panel stack">
          <strong>You need to sign in first.</strong>
          <p className="muted" style={{ margin: 0 }}>
            Sign in with your preferred method to start interviewing.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            <button type="button" onClick={loginWithGoogle} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Sign In with Google'}
            </button>
            <button type="button" onClick={loginWithAuth0} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Sign In with Auth0'}
            </button>
          </div>
        </section>
      ) : (
        <InterviewConfigForm
          onSubmit={submit}
          isSubmitting={createSessionMutation.isPending}
          errorMessage={createSessionMutation.isError ? toUiError(createSessionMutation.error) : ''}
        />
      )}
    </div>
  );
};
