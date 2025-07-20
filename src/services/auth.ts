import * as vscode from "vscode";
import * as crypto from "crypto";
import * as http from "http";
import { v4 as uuidv4 } from "uuid";
import { AuthTokens, OAuthWellKnownConfig } from "../models";
import { AUTH_SUCCESS_HTML } from "./auth-success";

// Client ID configuration - injected at build time or from environment
const getClientId = (): string => {
  // First try build-time injected CLIENT_ID
  if (process.env.CLIENT_ID) {
    return process.env.CLIENT_ID;
  }

  throw new Error(
    "CLIENT_ID is not defined. Please set the CLIENT_ID environment variable or inject it at build time."
  );
};

export class AuthService {
  private static readonly STORAGE_KEY = "agentlisa.auth";
  private static readonly CALLBACK_PORTS = [7154, 47154]; // LISA ports with fallback

  private baseUrl: string;
  private clientId: string;
  private tokens: AuthTokens | null = null;
  private wellKnownConfig: OAuthWellKnownConfig | null = null;

  constructor(private context: vscode.ExtensionContext) {
    this.baseUrl = this.getBaseUrl();
    this.clientId = getClientId();
    this.loadTokensFromStorage();
  }

  private getBaseUrl(): string {
    const config = vscode.workspace.getConfiguration("agentlisa");
    return (
      config.get("baseUrl") ||
      process.env.AGENTLISA_URL ||
      "https://agentlisa.ai"
    );
  }

  private getRedirectUri(port: number): string {
    return `http://localhost:${port}/callback`;
  }

  private async fetchWellKnownConfig(): Promise<OAuthWellKnownConfig | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/.well-known/oauth-protected-resource`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as OAuthWellKnownConfig;
      return data;
    } catch (error) {
      console.error("Failed to fetch OAuth well-known configuration:", error);
      vscode.window.showErrorMessage(
        "Failed to fetch OAuth configuration. Please check your API base URL."
      );
      return null;
    }
  }

  private async getAuthorizationServer(): Promise<string | null> {
    if (!this.wellKnownConfig) {
      this.wellKnownConfig = await this.fetchWellKnownConfig();
    }

    if (!this.wellKnownConfig?.authorization_servers?.length) {
      return null;
    }

    return this.wellKnownConfig.authorization_servers[0];
  }

  public isAuthenticated(): boolean {
    if (!this.tokens) {
      return false;
    }

    return Date.now() < this.tokens.expiresAt;
  }

  private isTokenExpiringSoon(): boolean {
    if (!this.tokens) {
      return false;
    }

    // Consider token as expiring soon if it expires within 1 minutes
    const fiveMinutesInMs = 1 * 60 * 1000;
    return Date.now() + fiveMinutesInMs >= this.tokens.expiresAt;
  }

  public async authenticate(): Promise<boolean> {
    try {
      // First, ensure we can fetch the OAuth configuration
      const authServer = await this.getAuthorizationServer();
      if (!authServer) {
        vscode.window.showErrorMessage(
          "Failed to fetch OAuth configuration. Please check your API base URL and ensure the service is available."
        );
        return false;
      }

      const { codeVerifier, codeChallenge } = this.generatePKCECodes();
      const state = uuidv4();

      const result = await this.startServerAndOpenBrowser(
        codeChallenge,
        state,
        authServer
      );
      if (!result) {
        return false;
      }

      const tokens = await this.exchangeCodeForTokens(
        result.authCode,
        codeVerifier,
        result.port,
        authServer
      );
      if (!tokens) {
        vscode.window.showErrorMessage(
          "Failed to exchange authorization code for tokens."
        );
        return false;
      }

      this.tokens = tokens;
      await this.saveTokensToStorage();

      vscode.window.showInformationMessage(
        "Successfully authenticated with AgentLISA!"
      );
      return true;
    } catch (error) {
      console.error("Authentication error:", error);
      vscode.window.showErrorMessage(`Authentication failed: ${error}`);
      return false;
    }
  }

  public async getAccessToken(): Promise<string | null> {
    // If we have a valid token that's not expiring soon, return it
    if (this.isAuthenticated() && !this.isTokenExpiringSoon()) {
      return this.tokens?.accessToken || null;
    }

    // If token is expiring soon or already expired, but we have a refresh token, try to refresh
    if (this.isAuthenticated() && this.tokens?.refreshToken) {
      const message = this.isTokenExpiringSoon()
        ? "Access token expiring soon, refreshing..."
        : "Access token expired, attempting to refresh...";
      console.log(message);

      const refreshSuccess = await this.refreshAccessToken();
      if (refreshSuccess) {
        return this.tokens?.accessToken || null;
      }
      console.log("Token refresh failed, will re-authenticate");
    }

    // If no refresh token or refresh failed, do full authentication
    console.log("No valid refresh token, starting full authentication flow");
    const success = await this.authenticate();
    if (!success) {
      return null;
    }

    return this.tokens?.accessToken || null;
  }

  public async logout(): Promise<void> {
    this.tokens = null;
    this.wellKnownConfig = null; // Clear cached config on logout
    await this.context.globalState.update(AuthService.STORAGE_KEY, null);
  }

  public clearConfigCache(): void {
    this.wellKnownConfig = null;
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.tokens?.refreshToken) {
      console.log("No refresh token available");
      return false;
    }

    try {
      const authServer = await this.getAuthorizationServer();
      if (!authServer) {
        return false;
      }

      const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.clientId,
        refresh_token: this.tokens.refreshToken,
      });

      const response = await fetch(`${authServer}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        console.error(`Token refresh failed: HTTP ${response.status}`);
        return false;
      }

      const data = await response.json();
      const { access_token, refresh_token, expires_in } = data;

      // Update tokens
      this.tokens = {
        accessToken: access_token,
        refreshToken: refresh_token || this.tokens.refreshToken, // Keep old refresh token if new one not provided
        expiresAt: Date.now() + expires_in * 1000,
      };

      await this.saveTokensToStorage();
      console.log("Successfully refreshed access token");
      return true;
    } catch (error) {
      console.error("Token refresh failed:", error);
      return false;
    }
  }

  private generatePKCECodes(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    return { codeVerifier, codeChallenge };
  }

  private buildAuthUrl(
    codeChallenge: string,
    state: string,
    port: number,
    authServer: string
  ): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.getRedirectUri(port),
      scope: "email profile",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return `${authServer}/oauth/authorize?${params.toString()}`;
  }

  private async startServerAndOpenBrowser(
    codeChallenge: string,
    state: string,
    authServer: string
  ): Promise<{ authCode: string; port: number } | null> {
    return new Promise((resolve) => {
      this.tryStartServer(0, codeChallenge, state, authServer, resolve);
    });
  }

  private async tryStartServer(
    portIndex: number,
    codeChallenge: string,
    state: string,
    authServer: string,
    resolve: (value: { authCode: string; port: number } | null) => void
  ): Promise<void> {
    if (portIndex >= AuthService.CALLBACK_PORTS.length) {
      vscode.window.showErrorMessage(
        `Failed to start OAuth callback server. Ports ${AuthService.CALLBACK_PORTS.join(
          ", "
        )} are all in use.`
      );
      resolve(null);
      return;
    }

    const port = AuthService.CALLBACK_PORTS[portIndex];
    const server = http.createServer();

    // Try to start the server on the current port
    server.listen(port, "localhost", () => {
      console.log(
        `OAuth callback server listening on port ${port} (LISA port ${
          portIndex + 1
        })`
      );

      // Build auth URL and open in external browser
      const authUrl = this.buildAuthUrl(codeChallenge, state, port, authServer);

      console.log("AUTH URL", authUrl);

      // Open in default browser
      vscode.env.openExternal(vscode.Uri.parse(authUrl));

      // Show info message to user
      vscode.window
        .showInformationMessage(
          `Opening AgentLISA authentication in your browser... (Using port ${port})`,
          "Cancel"
        )
        .then((action) => {
          if (action === "Cancel") {
            server.close();
            resolve(null);
          }
        });

      this.setupServerHandlers(server, state, port, resolve);
    });

    // Handle port already in use - try next port
    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.log(`Port ${port} is in use, trying next port...`);
        this.tryStartServer(
          portIndex + 1,
          codeChallenge,
          state,
          authServer,
          resolve
        );
      } else {
        console.error("OAuth callback server error:", err);
        vscode.window.showErrorMessage(
          `Failed to start OAuth callback server: ${err.message}`
        );
        resolve(null);
      }
    });
  }

  private setupServerHandlers(
    server: http.Server,
    state: string,
    port: number,
    resolve: (value: { authCode: string; port: number } | null) => void
  ): void {
    // Handle OAuth callback
    server.on("request", (req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end("Bad Request");
        return;
      }

      const url = new URL(req.url, `http://localhost:${port}`);

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        // Send success response to browser
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(AUTH_SUCCESS_HTML);

        // Close server
        server.close();

        // Validate and return result
        if (error) {
          vscode.window.showErrorMessage(`OAuth error: ${error}`);
          resolve(null);
        } else if (returnedState !== state) {
          vscode.window.showErrorMessage("Invalid state parameter");
          resolve(null);
        } else if (code) {
          resolve({ authCode: code, port });
        } else {
          resolve(null);
        }
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    // Set a timeout to close everything if no response is received
    setTimeout(() => {
      server.close();
      vscode.window.showWarningMessage(
        "Authentication timed out. Please try again."
      );
      resolve(null);
    }, 5 * 60 * 1000); // 5 minutes timeout
  }

  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    port: number,
    authServer: string
  ): Promise<AuthTokens | null> {
    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: this.clientId,
        code,
        redirect_uri: this.getRedirectUri(port), // Use the actual port that was used
        code_verifier: codeVerifier,
      });

      const response = await fetch(`${authServer}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const { access_token, refresh_token, expires_in } = data;

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + expires_in * 1000,
      };
    } catch (error) {
      console.error("Token exchange failed:", error);
      return null;
    }
  }

  private async loadTokensFromStorage(): Promise<void> {
    const stored = this.context.globalState.get<AuthTokens>(
      AuthService.STORAGE_KEY
    );
    if (stored) {
      this.tokens = stored;
    }
  }

  private async saveTokensToStorage(): Promise<void> {
    await this.context.globalState.update(AuthService.STORAGE_KEY, this.tokens);
  }
}
