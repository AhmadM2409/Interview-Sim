import jwt from 'jsonwebtoken';
import https from 'https';

const auth0Domain = process.env.VITE_AUTH0_DOMAIN || 'dev-m71z1z5w3vgzg8av.us.auth0.com';
const auth0ClientId = process.env.VITE_AUTH0_CLIENT_ID || 'u1eUTyGoyPcc4PXv8Xk5sY8l1pYEmXoH';
const auth0Secret = process.env.AUTH0_SECRET || '9rzdTt_stYkKPqqEkWC_kcVj-v-eXJxgD0hHe0II9lhQmb6MGDDhkeLmzsaZGStI';

let cachedKey = null;
let keyExpiry = null;

const getPublicKey = async () => {
  // Return cached key if still valid
  if (cachedKey && keyExpiry && Date.now() < keyExpiry) {
    return cachedKey;
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: auth0Domain,
      path: '/.well-known/jwks.json',
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jwks = JSON.parse(data);
          const key = jwks.keys[0];
          if (key && key.x5c && key.x5c.length > 0) {
            const cert = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
            // Cache for 1 hour
            cachedKey = cert;
            keyExpiry = Date.now() + 3600000;
            resolve(cert);
          } else {
            reject(new Error('No valid keys found in JWKS'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

export const isValidAuthToken = async (token) => {
  try {
    // For development/testing: accept mock tokens
    if (token === 'mock-auth-token') {
      return true;
    }

    const publicKey = await getPublicKey();
    const decoded = jwt.verify(token, publicKey, {
      audience: process.env.VITE_AUTH0_AUDIENCE || 'http://localhost:3000/api',
      issuer: `https://${auth0Domain}/`,
      algorithms: ['RS256'],
    });

    return Boolean(decoded);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Token validation error:', error.message);
    return false;
  }
};

export const getTestAuthToken = () => 'mock-auth-token';
