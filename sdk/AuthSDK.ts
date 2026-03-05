import { AuthProvider } from './AuthProvider';
import { AuthConfig, AuthResult, LoginFlow } from './types';

export { LoginFlow };

export class PasswiserLoginsSDK {
  private authProvider: AuthProvider;

  constructor(config: AuthConfig) {
    this.authProvider = new AuthProvider(config);
  }

  async login(flow: LoginFlow = LoginFlow.SIWE): Promise<AuthResult> {
    return this.authProvider.login(flow);
  }

  async handleOAuthCallback(): Promise<AuthResult | null> {
    return this.authProvider.handleOAuthCallback();
  }
}
