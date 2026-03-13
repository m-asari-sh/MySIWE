export interface AuthConfig {
  clientId: string;
  baseUrl: string;
  scope: string;
  redirectUri?: string;
  walletConnectProjectId?: string;
  walletConnectChains?: number[];
}

export enum LoginFlow {
  SIWE = 'siwe',
  SIWE_WALLETCONNECT = 'siwe_walletconnect',
}

export interface AuthResult {
  id_token: string;
  access_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
  refresh_token?: string;
}

export class AuthError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = 'AuthError';
  }
}
