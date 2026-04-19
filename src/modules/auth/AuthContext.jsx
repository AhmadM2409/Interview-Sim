import { createContext, useContext } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const auth0CallbackUrl = import.meta.env.VITE_AUTH0_CALLBACK_URL;

  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        redirect_uri: auth0CallbackUrl,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        connection: 'google-oauth2',
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      <Auth0ContextWrapper>{children}</Auth0ContextWrapper>
    </Auth0Provider>
  );
};

const Auth0ContextWrapper = ({ children }) => {
  const { loginWithRedirect, logout, isAuthenticated, user, getAccessTokenSilently, isLoading } =
    useAuth0();

  const getToken = async () => {
    if (!isAuthenticated) {
      return null;
    }
    try {
      return await getAccessTokenSilently({
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error getting access token:', error);
      return null;
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    user,
    token: null, // Will be fetched dynamically
    getToken,
    loginWithAuth0: () =>
      loginWithRedirect({
        appState: { returnTo: window.location.pathname },
      }),
    loginWithGoogle: () =>
      loginWithRedirect({
        connection: 'google-oauth2',
        appState: { returnTo: window.location.pathname },
      }),
    loginWithDemo: () =>
      loginWithRedirect({
        appState: { returnTo: window.location.pathname },
      }),
    logout: () => logout({ logoutParams: { returnTo: window.location.origin } }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return value;
};
