import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { initializeCodingSetup } from '../api/codingApi.js';
import { toUiError } from '../../shared/api/client.js';

export const CodingSetupPage = () => {
  const { token, isAuthenticated, loginWithGoogle, loginWithAuth0, isLoading, getToken } = useAuth();
  const [language, setLanguage] = useState('javascript');
  const [problem, setProblem] = useState('array-transform');

  const setupMutation = useMutation({
    mutationFn: async () => {
      const authToken = await getToken();
      return initializeCodingSetup({ token: authToken, language, problem });
    },
  });

  if (!isAuthenticated) {
    return (
      <section className="panel stack">
        <strong>You need to sign in first.</strong>
        <p className="muted" style={{ margin: 0 }}>
          Sign in with your preferred method to start coding.
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
    );
  }

  return (
    <div className="stack">
      <section className="stack" style={{ gap: 6 }}>
        <h1 className="page-title">Coding Setup</h1>
        <p className="page-subtitle">Prepare your coding interview mode. Editor/terminal implementation is intentionally pending.</p>
      </section>

      <section className="panel stack">
        <label>
          Language
          <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={setupMutation.isPending}>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </label>

        <label>
          Problem Track
          <select value={problem} onChange={(event) => setProblem(event.target.value)} disabled={setupMutation.isPending}>
            <option value="array-transform">Array Transform</option>
            <option value="graph-traversal">Graph Traversal</option>
            <option value="api-design">API Design</option>
          </select>
        </label>

        {setupMutation.isError ? <div className="alert">{toUiError(setupMutation.error)}</div> : null}
        {setupMutation.isSuccess ? <div className="alert warning">{setupMutation.data.message}</div> : null}

        <button type="button" onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
          {setupMutation.isPending ? 'Preparing coding mode...' : 'Continue to Coding Mode'}
        </button>
      </section>
    </div>
  );
};
