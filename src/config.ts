/**
 * Auth configuration for Passwiser SIWE.
 * Override with .env: VITE_API_BASE_URL, VITE_CLIENT_ID, VITE_SCOPE
 */
export const authConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'https://dev.pw-idsr.dev',
  clientId: import.meta.env.VITE_CLIENT_ID ?? 'dev-authCode1',
  scope: import.meta.env.VITE_SCOPE ?? 'openid',
  redirectUri: typeof window !== 'undefined'
    ? window.location.origin + window.location.pathname
    : '',
};
