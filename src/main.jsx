import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './modules/auth/AuthContext.jsx';
import { AppRouterProvider } from './app/router.jsx';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AppRouterProvider />
    </AuthProvider>
  </QueryClientProvider>,
);
