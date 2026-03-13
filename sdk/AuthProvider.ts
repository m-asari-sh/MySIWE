import Web3 from 'web3';
import EthereumProvider from '@walletconnect/ethereum-provider';
import { AuthConfig, AuthError, AuthResult, LoginFlow } from './types';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      sendAsync?: (
        request: { id?: number | string; method: string; params?: unknown[] },
        callback: (error: Error | null, response: unknown) => void
      ) => void;
      send?: (
        request: { id?: number | string; method: string; params?: unknown[] },
        callback: (error: Error | null, response: unknown) => void
      ) => void;
    };
    web3?: Web3;
  }
}

type EvmRequest = {
  id?: number | string;
  method: string;
  params?: unknown[];
};

type EvmResponse = {
  jsonrpc: '2.0';
  id?: number | string;
  result: unknown;
};

type EvmProvider = {
  sendAsync: (request: EvmRequest, callback: (error: Error | null, response: EvmResponse | null) => void) => void;
  send: (request: EvmRequest, callback: (error: Error | null, response: EvmResponse | null) => void) => void;
};

type SiweNonceResponse = { nonce: string };
type SiweMessageResponse = { message: string };
type WalletConnectProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  disconnect?: () => Promise<void>;
};

export class AuthProvider {
  private config: AuthConfig;
  private web3: Web3 | null = null;
  private walletConnectProvider: WalletConnectProvider | null = null;
  private readonly ENDPOINTS = {
    TOKEN: '/connect/token',
    SIWE_NONCE: '/Account/Siwe/Nonce',
    SIWE_MESSAGE: '/Account/Siwe/Message',
  } as const;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  private async initializeWeb3(): Promise<boolean> {
    if (typeof window.ethereum === 'undefined') {
      return false;
    }

    try {
      const provider: EvmProvider = {
        sendAsync: (request, callback) => {
          if (request.method === 'eth_accounts' || request.method === 'eth_requestAccounts') {
            window.ethereum!
              .request({ method: request.method })
              .then((accounts) => {
                callback(null, {
                  jsonrpc: '2.0',
                  id: request.id,
                  result: accounts,
                });
              })
              .catch((error: Error) => {
                callback(error, null);
              });
            return;
          }

          window.ethereum!
            .request({
              method: request.method,
              params: request.params || [],
            })
            .then((result) => {
              callback(null, {
                jsonrpc: '2.0',
                id: request.id,
                result,
              });
            })
            .catch((error: Error) => {
              callback(error, null);
            });
        },
        send: (request, callback) => {
          provider.sendAsync(request, callback);
        },
      };

      this.web3 = new Web3(provider as never);
      return true;
    } catch (error) {
      console.error('Failed to initialize Web3:', error);
      return false;
    }
  }

  async login(flow: LoginFlow): Promise<AuthResult> {
    switch (flow) {
      case LoginFlow.SIWE:
        return this.handleSiweLogin();
      case LoginFlow.SIWE_WALLETCONNECT:
        return this.handleWalletConnectSiweLogin();
      default:
        throw new AuthError(`Unsupported login flow: ${flow}`, 'UNSUPPORTED_FLOW');
    }
  }

  private async handleSiweLogin(): Promise<AuthResult> {
    if (!this.web3) {
      const web3Available = await this.initializeWeb3();
      if (!web3Available) {
        throw new AuthError('MetaMask not installed', 'NO_ETHEREUM_PROVIDER');
      }
    }

    try {
      const accounts = (await window.ethereum!.request({ method: 'eth_requestAccounts' })) as string[];
      const walletAddress = accounts[0];
      const chainId = (await window.ethereum!.request({ method: 'eth_chainId' })) as string;

      const nonceData = await this.fetchSiweNonce(walletAddress);
      const messageData = await this.fetchSiweMessage(nonceData.nonce);
      const signature = await this.signMessageWithWeb3(messageData.message, walletAddress);
      return this.exchangeSiweToken(signature, walletAddress, chainId);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('SIWE login failed', 'SIWE_FAILED');
    }
  }

  private async handleWalletConnectSiweLogin(): Promise<AuthResult> {
    const provider = await this.initializeWalletConnectProvider();

    try {
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
      const walletAddress = accounts[0];
      const chainIdResult = await provider.request({ method: 'eth_chainId' });
      const chainId = typeof chainIdResult === 'number' ? `0x${chainIdResult.toString(16)}` : String(chainIdResult);

      const nonceData = await this.fetchSiweNonce(walletAddress);
      const messageData = await this.fetchSiweMessage(nonceData.nonce);
      const signature = await this.signMessageWithWalletConnect(provider, messageData.message, walletAddress);

      return this.exchangeSiweToken(signature, walletAddress, chainId);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('WalletConnect SIWE login failed', 'SIWE_WALLETCONNECT_FAILED');
    }
  }

  async handleOAuthCallback(): Promise<AuthResult | null> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const storedState = sessionStorage.getItem('oauth_state');
    sessionStorage.removeItem('oauth_state');

    if (!code || !state) {
      return null;
    }

    if (state !== storedState) {
      throw new AuthError('Invalid state parameter', 'INVALID_STATE');
    }

    const redirectUri = this.config.redirectUri ?? window.location.origin + window.location.pathname;
    const tokenResponse = await fetch(`${this.config.baseUrl}${this.ENDPOINTS.TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        code,
        redirect_uri: redirectUri,
        scope: this.config.scope,
      }),
    });

    if (!tokenResponse.ok) {
      throw new AuthError('Failed to get tokens', 'TOKEN_FAILED', tokenResponse.status);
    }

    return (await tokenResponse.json()) as AuthResult;
  }

  private async signMessageWithWeb3(message: string, walletAddress: string): Promise<string> {
    try {
      if (!this.web3) {
        throw new AuthError('Web3 not initialized', 'WEB3_NOT_INITIALIZED');
      }

      return await this.web3.eth.personal.sign(this.web3.utils.utf8ToHex(message), walletAddress, '');
    } catch {
      throw new AuthError('Failed to sign message', 'SIGN_FAILED');
    }
  }

  private async initializeWalletConnectProvider(): Promise<WalletConnectProvider> {
    if (this.walletConnectProvider) {
      return this.walletConnectProvider;
    }

    const projectId = this.config.walletConnectProjectId;
    if (!projectId) {
      throw new AuthError('WalletConnect project id is missing', 'WALLETCONNECT_PROJECT_ID_MISSING');
    }

    const chains = this.config.walletConnectChains?.length ? this.config.walletConnectChains : [1];

    try {
      this.walletConnectProvider = (await EthereumProvider.init({
        projectId,
        chains,
        showQrModal: true,
      })) as WalletConnectProvider;

      return this.walletConnectProvider;
    } catch {
      throw new AuthError('Failed to initialize WalletConnect', 'WALLETCONNECT_INIT_FAILED');
    }
  }

  private async signMessageWithWalletConnect(
    provider: WalletConnectProvider,
    message: string,
    walletAddress: string
  ): Promise<string> {
    const messageHex = this.toHex(message);
    try {
      return (await provider.request({
        method: 'personal_sign',
        params: [messageHex, walletAddress],
      })) as string;
    } catch {
      throw new AuthError('Failed to sign message with WalletConnect', 'WALLETCONNECT_SIGN_FAILED');
    }
  }

  private toHex(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let hex = '0x';
    bytes.forEach((byte) => {
      hex += byte.toString(16).padStart(2, '0');
    });
    return hex;
  }

  private async fetchSiweNonce(walletAddress: string): Promise<SiweNonceResponse> {
    const nonceResponse = await fetch(
      `${this.config.baseUrl}${this.ENDPOINTS.SIWE_NONCE}?client_id=${this.config.clientId}&evm_wallet_address=${walletAddress}`,
      { method: 'GET' }
    );

    if (!nonceResponse.ok) {
      throw new AuthError('Failed to get nonce', 'NONCE_FAILED', nonceResponse.status);
    }

    return (await nonceResponse.json()) as SiweNonceResponse;
  }

  private async fetchSiweMessage(nonce: string): Promise<SiweMessageResponse> {
    const messageResponse = await fetch(
      `${this.config.baseUrl}${this.ENDPOINTS.SIWE_MESSAGE}?client_id=${this.config.clientId}&nonce=${nonce}`,
      { method: 'GET' }
    );

    if (!messageResponse.ok) {
      throw new AuthError('Failed to get message', 'MESSAGE_FAILED', messageResponse.status);
    }

    return (await messageResponse.json()) as SiweMessageResponse;
  }

  private async exchangeSiweToken(signature: string, walletAddress: string, chainId: string): Promise<AuthResult> {
    const tokenResponse = await fetch(`${this.config.baseUrl}${this.ENDPOINTS.TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'siwe',
        client_id: this.config.clientId,
        signature,
        evm_wallet_address: walletAddress,
        chain_id: chainId,
        scope: this.config.scope,
      }),
    });

    if (!tokenResponse.ok) {
      throw new AuthError('Failed to get tokens', 'TOKEN_FAILED', tokenResponse.status);
    }

    return (await tokenResponse.json()) as AuthResult;
  }
}
