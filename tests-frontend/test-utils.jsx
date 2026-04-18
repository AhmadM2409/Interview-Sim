import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import { afterEach } from 'vitest';
import { AuthProvider } from '../src/modules/auth/AuthContext.jsx';

const STORAGE_KEY = 'ai_interview_demo_token';

export const renderWithProviders = (ui, { authenticated = true } = {}) => {
  if (authenticated) {
    window.localStorage.setItem(STORAGE_KEY, 'mock-auth-token');
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{ui}</AuthProvider>
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(STORAGE_KEY);
});
