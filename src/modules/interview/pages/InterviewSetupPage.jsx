import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { createInterviewSession } from '../api/interviewApi.js';
import { InterviewConfigForm } from '../components/InterviewConfigForm.jsx';
import { toUiError } from '../../shared/api/client.js';

export const InterviewSetupPage = ({ onSessionCreated }) => {
  const { token, isAuthenticated, loginWithDemo } = useAuth();

  const createSessionMutation = useMutation({
    mutationFn: ({ role, level }) => createInterviewSession({ token, role, level }),
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
            This environment uses a local demo sign-in.
          </p>
          <div>
            <button type="button" onClick={loginWithDemo}>
              Sign In (Demo)
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
