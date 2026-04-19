# Auth0 Integration Setup

This document describes the Auth0 integration with Google OAuth support for the Interview Sim application.

## Configuration

The application has been configured with Auth0 using the following credentials:

### Frontend (.env)
```
VITE_AUTH0_DOMAIN=dev-m71z1z5w3vgzg8av.us.auth0.com
VITE_AUTH0_CLIENT_ID=u1eUTyGoyPcc4PXv8Xk5sY8l1pYEmXoH
VITE_AUTH0_CALLBACK_URL=http://localhost:3000
VITE_AUTH0_AUDIENCE=http://localhost:3000/api
```

### Backend (.env)
```
AUTH0_SECRET=9rzdTt_stYkKPqqEkWC_kcVj-v-eXJxgD0hHe0II9lhQmb6MGDDhkeLmzsaZGStI
```

## Features

### Frontend Authentication
- **Auth0Provider**: Wraps the entire application with Auth0 authentication
- **Google OAuth**: Integrated as a connection option for seamless login
- **Access Tokens**: Automatically refreshed and cached in localStorage
- **useAuth Hook**: Provides authentication context throughout the app

#### Available Auth Methods
```javascript
const { 
  isAuthenticated,     // Boolean - authentication status
  user,               // Object - user profile
  getToken,           // Function - get access token
  loginWithGoogle,    // Function - login with Google
  loginWithAuth0,     // Function - login with Auth0
  logout,             // Function - logout
  isLoading           // Boolean - loading state
} = useAuth();
```

### Backend Authentication
- **JWT Validation**: Validates Auth0 JWTs using public keys from Auth0's JWKS endpoint
- **Token Caching**: Caches public keys for 1 hour to reduce JWKS requests
- **Mock Token Support**: Dev mode accepts `mock-auth-token` for testing
- **Async Middleware**: Authentication middleware properly handles async JWT validation

## Updated Pages

The following pages have been updated to support Auth0 authentication:

1. **InterviewSetupPage** - Login with Google or Auth0
2. **CodingSetupPage** - Login with Google or Auth0
3. **InterviewSessionPage** - Login with Google
4. **InterviewSummaryPage** - Login with Google

## Dependencies Added

- `@auth0/auth0-react` - Auth0 SDK for React
- `jsonwebtoken` - JWT validation on backend
- `express-oauth2-jwt-bearer` - OAuth2 JWT middleware

## Running the Application

### Frontend
```bash
npm run dev
# Runs on http://localhost:3000/
```

### Backend API
```bash
npm run start:api
# Runs on http://localhost:3000/api
```

## Testing

### Mock Login (Development)
For testing without Auth0, the backend accepts the mock token `mock-auth-token`.

### Real Auth0 Login
1. Visit http://localhost:3000/
2. Click "Sign In with Google" or "Sign In with Auth0"
3. Complete the Auth0 login flow
4. Application will request an access token
5. Token is automatically included in API requests

## Security Notes

- Access tokens are stored in localStorage
- Tokens are automatically refreshed before expiry
- All API endpoints require Authorization header with Bearer token
- CORS is configured to allow requests from localhost:3000
- Auth0 domain and client ID are configured in .env

## Troubleshooting

### Token Validation Fails
- Check that Auth0 credentials are correct in .env
- Verify Auth0 JWKS endpoint is accessible
- Check token hasn't expired

### CORS Errors
- Ensure FRONTEND_ORIGIN in .env matches your frontend URL
- Verify ALLOWED_ORIGINS configuration in backend

### Google Login Not Working
- Ensure Google OAuth is configured in your Auth0 application settings
- Verify callback URL matches VITE_AUTH0_CALLBACK_URL in .env
