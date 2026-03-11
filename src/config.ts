/**
 * Auth configuration for Passwiser SIWE.
 * Override with .env: VITE_API_BASE_URL, VITE_CLIENT_ID, VITE_SCOPE
 */
export const authConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'https://auth02-dev.palmerbet.online',
  clientId: import.meta.env.VITE_CLIENT_ID ?? 'pMl7TKK8EiqQFMKMNlEbyhirOYg9Xi5W',
  scope: import.meta.env.VITE_SCOPE ?? 'openid',
  redirectUri: typeof window !== 'undefined'
    ? window.location.origin + window.location.pathname
    : '',
};
