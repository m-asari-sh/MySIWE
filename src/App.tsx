import { useEffect, useState } from 'react';
import { PasswiserLoginsSDK, LoginFlow, AuthError, type AuthResult } from '../sdk';
import { authConfig } from './config';
import './App.css';

const STORAGE_KEYS = {
  accessToken: 'siwe_access_token',
  idToken: 'siwe_id_token',
  tokenType: 'siwe_token_type',
  scope: 'siwe_scope',
  expiresIn: 'siwe_expires_in',
} as const;

function getStoredTokens() {
  const idToken = localStorage.getItem(STORAGE_KEYS.idToken);
  const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
  if (!idToken || !accessToken) return null;
  const expiresIn = localStorage.getItem(STORAGE_KEYS.expiresIn);
  return {
    access_token: accessToken,
    id_token: idToken,
    token_type: localStorage.getItem(STORAGE_KEYS.tokenType) ?? 'Bearer',
    scope: localStorage.getItem(STORAGE_KEYS.scope) ?? '',
    expires_in: expiresIn ? Number(expiresIn) : 0,
  };
}

function saveTokens(tokens: AuthResult) {
  if (tokens.access_token) localStorage.setItem(STORAGE_KEYS.accessToken, String(tokens.access_token));
  if (tokens.id_token) localStorage.setItem(STORAGE_KEYS.idToken, String(tokens.id_token));
  if (tokens.token_type) localStorage.setItem(STORAGE_KEYS.tokenType, String(tokens.token_type));
  if (tokens.scope) localStorage.setItem(STORAGE_KEYS.scope, String(tokens.scope));
  if (tokens.expires_in != null) localStorage.setItem(STORAGE_KEYS.expiresIn, String(tokens.expires_in));
}

function clearTokens() {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
}

const sdk = new PasswiserLoginsSDK({
  clientId: authConfig.clientId,
  baseUrl: authConfig.baseUrl,
  scope: authConfig.scope,
  redirectUri: authConfig.redirectUri,
});

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function hasEthereumProvider(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as Window & { ethereum?: unknown }).ethereum;
}

/** Opens this page in MetaMask mobile in-app browser (SIWE works there via injected provider). */
function getMetaMaskDappUrl(): string {
  const dappUrl = (window.location.origin + window.location.pathname + window.location.search)
    .replace('https://', '')
    .replace('http://', '');
  return `https://link.metamask.io/dapp/${dappUrl}`;
}

export default function App() {
  const [tokens, setTokens] = useState<AuthResult | null>(() => getStoredTokens());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMobileDevice = isMobile();
  const hasWallet = hasEthereumProvider();
  const shouldOpenInMetaMask = isMobileDevice && !hasWallet;

  useEffect(() => {
    const run = async () => {
      try {
        const result = await sdk.handleOAuthCallback();
        if (result) {
          saveTokens(result);
          setTokens(result);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch {
        // ignore
      }
    };
    run();
  }, []);

  const handleSiweLogin = async () => {
    if (shouldOpenInMetaMask) {
      window.location.href = getMetaMaskDappUrl();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await sdk.login(LoginFlow.SIWE);
      saveTokens(result);
      setTokens(result);
    } catch (err: unknown) {
      const message = err instanceof AuthError ? err.message : err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = () => {
    clearTokens();
    setTokens(null);
    setError(null);
  };

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">SIWE Login</h1>
        <p className="subtitle">Sign-in with Ethereum · Passwiser</p>
      </header>

      <main className="main">
        {!tokens ? (
          <>
            <p className="intro">
              Connect your Ethereum wallet to sign in. Use MetaMask or another Web3 wallet.
            </p>
            {error && <div className="error" role="alert">{error}</div>}
            <button
              type="button"
              className="btn btn-siwe"
              onClick={handleSiweLogin}
              disabled={loading}
              aria-busy={loading}
            >
              {loading
                ? 'Connecting…'
                : shouldOpenInMetaMask
                  ? 'Open in MetaMask to sign in'
                  : 'Sign in with Ethereum'}
            </button>
            {shouldOpenInMetaMask && (
              <p className="hint">
                This will open the MetaMask app with this page. Then tap “Sign in with Ethereum” there.
              </p>
            )}
            {!shouldOpenInMetaMask && (
              <p className="hint">
                No wallet? Install MetaMask or another Web3 wallet to try SIWE.
              </p>
            )}
          </>
        ) : (
          <div className="tokens-panel">
            <h2 className="tokens-title">Signed in</h2>
            <div className="token-row">
              <span className="token-label">Access token</span>
              <code className="token-value token-value-scroll">{tokens.access_token ?? ''}</code>
            </div>
            <div className="token-row">
              <span className="token-label">ID token</span>
              <code className="token-value token-value-scroll">{tokens.id_token ?? ''}</code>
            </div>
            <div className="token-row">
              <span className="token-label">Expires in</span>
              <code className="token-value">{tokens.expires_in} s</code>
            </div>
            <button type="button" className="btn btn-return" onClick={handleReturn}>
              Return
            </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <span>Passwiser SIWE Mobile Sample · React</span>
      </footer>
    </div>
  );
}
