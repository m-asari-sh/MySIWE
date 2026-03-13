# SIWE Mobile Login Sample (React)

A **mobile-friendly** React sample that demonstrates **Sign-in with Ethereum (SIWE)** using the Passwiser Logins SDK, with both MetaMask/injected wallet and WalletConnect login options.

## Prerequisites

- **Node.js** 18+
- A **Web3 wallet** (e.g. MetaMask) for SIWE, ideally with the mobile browser or a desktop browser with the extension.

The Passwiser Logins SDK is included in this repo under `sdk/` — no external SDK path is required.

## Setup and run

1. From the project folder:

   ```bash
   npm install
   npm run dev
   ```

2. Open the URL shown (e.g. `http://localhost:5173`) in a browser (or on a phone on the same network).

3. Click **Sign in with Ethereum** (MetaMask/injected wallet) or **Sign in with WalletConnect** and approve the connection and message in your wallet.

## Configuration

Override the default Passwiser server and client via environment variables (create a `.env` file in the project root):

- `VITE_API_BASE_URL` — Passwiser auth server base URL (default: `https://dev.pw-idsr.dev`)
- `VITE_CLIENT_ID` — Client id (default: `dev-authCode1`)
- `VITE_SCOPE` — Scope (default: `openid`)
- `VITE_WALLETCONNECT_PROJECT_ID` — WalletConnect project id (required for WalletConnect button)
- `VITE_WALLETCONNECT_CHAIN_ID` — EVM chain id as decimal (default: `1`)

Example:

```env
VITE_API_BASE_URL=https://dev.pw-idsr.dev
VITE_CLIENT_ID=dev-authCode1
VITE_SCOPE=openid
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
VITE_WALLETCONNECT_CHAIN_ID=1
```

## CORS

The app calls the Passwiser API from the browser. If the auth server does not allow your origin (e.g. `http://localhost:5173`), you may need to:

- Run the sample behind the same backend as the main Passwiser demo (which proxies `/token` and can proxy other endpoints), or  
- Configure CORS on the Passwiser server for your dev origin.

## Project structure

- `src/App.tsx` — Main UI and SIWE login flows using `PasswiserLoginsSDK` (`LoginFlow.SIWE` and `LoginFlow.SIWE_WALLETCONNECT`).
- `src/config.ts` — Auth config (base URL, client id, scope) from env.
- `src/main.tsx` — React entry point.
- `sdk/` — Passwiser Logins SDK (included; SIWE + OAuth flows). No external SDK reference needed.

## Build for production

```bash
npm run build
npm run preview
```

Output is in `dist/`. Serve it with any static host or your backend.
