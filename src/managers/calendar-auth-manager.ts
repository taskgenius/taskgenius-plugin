/**
 * Calendar Authentication Manager
 *
 * Handles OAuth 2.0 authentication flows with PKCE (Proof Key for Code Exchange)
 * for Google Calendar and Microsoft Outlook Calendar integration.
 *
 * Security considerations:
 * - Uses PKCE flow as we're a public client (no client secret)
 * - State parameter prevents CSRF attacks
 * - Tokens stored in Obsidian's data.json (users warned not to share)
 * - Automatic token refresh before expiration
 *
 * @module calendar-auth-manager
 */

import { Component, requestUrl, Notice, Plugin } from "obsidian";
import type { Server, IncomingMessage, ServerResponse } from "http";
import {
	CalendarProviderType,
	OAuthTokenData,
	OAuthEndpoints,
	PKCEData,
	OAuthConnectionState,
} from "../types/calendar-provider";
import { t } from "../translations/helper";

// Node.js http module (available in Electron)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const http = require("http") as typeof import("http");

/**
 * Decode base64-encoded string
 * Used to decode secrets injected at build time for basic obfuscation
 */
function decodeBase64(encoded: string): string {
	if (!encoded) return "";
	try {
		return atob(encoded);
	} catch {
		return "";
	}
}

// ============================================================================
// OAuth Provider Configuration
// ============================================================================

/**
 * OAuth provider endpoint configuration
 */
interface OAuthProviderConfig {
	/** Authorization endpoint URL */
	authorizationUrl: string;
	/** Token endpoint URL */
	tokenUrl: string;
	/** Token revocation endpoint URL (optional) */
	revokeUrl?: string;
	/** User info endpoint URL (optional) */
	userInfoUrl?: string;
	/** Default OAuth scopes */
	defaultScopes: string[];
	/** OAuth client ID (placeholder - should be configurable) */
	clientId: string;
	/** OAuth client secret (for Desktop apps, this is not confidential) */
	clientSecret?: string;
}

/**
 * OAuth provider configurations
 *
 * Google OAuth uses a public client ID for desktop/native apps.
 * This is safe to include in open source code as PKCE flow doesn't require client secret.
 * Users can also configure their own client ID in settings if preferred.
 */
const OAUTH_PROVIDERS: Record<"google" | "outlook", OAuthProviderConfig> = {
	google: {
		authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
		tokenUrl: "https://oauth2.googleapis.com/token",
		revokeUrl: "https://oauth2.googleapis.com/revoke",
		userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
		// Using full calendar scope for read/write access to calendars and events
		// calendar.events alone doesn't allow listing calendars
		// See: https://developers.google.com/calendar/api/auth
		defaultScopes: [
			"https://www.googleapis.com/auth/calendar",
			"https://www.googleapis.com/auth/userinfo.email",
		],
		clientId:
			"707820255464-c72a7md4omp101t4jtncq4vempt81stk.apps.googleusercontent.com",
		// Desktop app client secret - not confidential per Google's documentation
		// See: https://developers.google.com/identity/protocols/oauth2/native-app
		// Injected at build time via esbuild define, base64-encoded for basic obfuscation
		clientSecret: decodeBase64(process.env.GOOGLE_CLIENT_SECRET_B64 || ""),
	},
	outlook: {
		authorizationUrl:
			"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
		tokenUrl:
			"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
		userInfoUrl: "https://graph.microsoft.com/v1.0/me",
		// Using Calendars.ReadWrite for read/write access to calendars
		// See: https://learn.microsoft.com/en-us/graph/permissions-reference#calendar-permissions
		defaultScopes: ["Calendars.ReadWrite", "User.Read", "offline_access"],
		// Azure AD Application Client ID for Task Genius
		// Registered at: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps
		clientId: "e1727739-0a4f-4827-a743-f7933cb3f6bf",
	},
};

/**
 * OAuth callback configuration
 * Uses local HTTP server for reliable OAuth callback handling
 */
const OAUTH_CALLBACK_HOST = "127.0.0.1";
const OAUTH_CALLBACK_PORT_START = 42813; // Starting port, will try next if busy
const OAUTH_CALLBACK_PORT_END = 42823; // Maximum port to try
const OAUTH_CALLBACK_PATH = "/oauth/callback";

/**
 * Legacy Obsidian protocol URI for OAuth callback (fallback)
 */
const OBSIDIAN_PROTOCOL = "obsidian";
const PROTOCOL_ACTION = "task-genius-oauth";
const LEGACY_REDIRECT_URI = `${OBSIDIAN_PROTOCOL}://${PROTOCOL_ACTION}`;

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by CalendarAuthManager
 */
export type AuthManagerEvent =
	| {
			type: "status-change";
			provider: "google" | "outlook";
			status: OAuthConnectionState;
	  }
	| {
			type: "auth-success";
			provider: "google" | "outlook";
			tokens: OAuthTokenData;
			email?: string;
	  }
	| { type: "auth-error"; provider: "google" | "outlook"; error: Error }
	| {
			type: "token-refreshed";
			provider: "google" | "outlook";
			tokens: OAuthTokenData;
	  }
	| { type: "disconnected"; provider: "google" | "outlook" };

type EventCallback = (event: AuthManagerEvent) => void;

// ============================================================================
// Pending Request Tracking
// ============================================================================

/**
 * Tracks pending OAuth requests to validate callbacks
 */
interface PendingOAuthRequest {
	/** The OAuth provider for this request */
	provider: "google" | "outlook";
	/** PKCE code verifier (kept secret, never sent to auth server) */
	codeVerifier: string;
	/** Timestamp when request was initiated */
	createdAt: number;
	/** Optional callback source ID for multi-source scenarios */
	sourceId?: string;
	/** Tenant ID for Outlook (affects endpoint URLs) */
	tenantId?: string;
	/** Redirect URI used for this request (needed for token exchange) */
	redirectUri: string;
}

/**
 * Timeout for pending requests (10 minutes)
 */
const PENDING_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Buffer time before token expiration to trigger refresh (5 minutes)
 */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// ============================================================================
// CalendarAuthManager Class
// ============================================================================

/**
 * Manages OAuth 2.0 authentication for calendar providers
 */
export class CalendarAuthManager extends Component {
	/** Pending OAuth requests indexed by state parameter */
	private pendingRequests = new Map<string, PendingOAuthRequest>();

	/** Event listeners */
	private eventListeners: EventCallback[] = [];

	/** OAuth client configurations (initialized from OAUTH_PROVIDERS, can be updated at runtime) */
	private clientConfigs: Record<"google" | "outlook", { clientId: string }> =
		{
			google: { clientId: OAUTH_PROVIDERS.google.clientId },
			outlook: { clientId: OAUTH_PROVIDERS.outlook.clientId },
		};

	/** Reference to the plugin for protocol handler registration */
	private plugin: Plugin | null = null;

	/** Local HTTP server for OAuth callback */
	private callbackServer: Server | null = null;

	/** Current callback server port */
	private callbackPort = 0;

	constructor() {
		super();
	}

	// =========================================================================
	// Lifecycle
	// =========================================================================

	/**
	 * Register the Obsidian protocol handler for OAuth callbacks (legacy fallback)
	 * Also starts the local HTTP server for more reliable callback handling
	 * Must be called during plugin initialization
	 */
	registerProtocolHandler(plugin: Plugin): void {
		this.plugin = plugin;

		// Register legacy Obsidian protocol handler as fallback
		plugin.registerObsidianProtocolHandler(PROTOCOL_ACTION, (params) => {
			this.handleOAuthCallback(params);
		});
		console.log(
			`[CalendarAuthManager] Registered legacy protocol handler: ${LEGACY_REDIRECT_URI}`,
		);
	}

	/**
	 * Configure OAuth client IDs
	 * Should be called with user-configured values from settings
	 */
	configureClients(config: {
		googleClientId?: string;
		outlookClientId?: string;
	}): void {
		if (config.googleClientId) {
			this.clientConfigs.google.clientId = config.googleClientId;
		}
		if (config.outlookClientId) {
			this.clientConfigs.outlook.clientId = config.outlookClientId;
		}
	}

	/**
	 * Check if a provider is configured (has client ID)
	 */
	isProviderConfigured(provider: "google" | "outlook"): boolean {
		return !!this.clientConfigs[provider].clientId;
	}

	// =========================================================================
	// OAuth Flow
	// =========================================================================

	/**
	 * Initiate OAuth 2.0 authorization flow with PKCE
	 * Opens the user's browser to the provider's login page
	 */
	async startOAuthFlow(
		provider: "google" | "outlook",
		options?: {
			sourceId?: string;
			tenantId?: string; // For Outlook: 'common', 'consumers', 'organizations', or tenant GUID
		},
	): Promise<void> {
		const clientId = this.clientConfigs[provider].clientId;
		if (!clientId) {
			const error = new Error(
				`OAuth client ID not configured for ${provider}. Please configure it in settings.`,
			);
			this.emit({ type: "auth-error", provider, error });
			new Notice(
				t(
					`Please configure ${provider === "google" ? "Google" : "Outlook"} Calendar client ID in settings`,
				),
			);
			return;
		}

		this.emit({ type: "status-change", provider, status: "connecting" });

		try {
			// Start local callback server
			const redirectUri = await this.startCallbackServer();

			// Generate PKCE parameters
			const pkce = await this.generatePKCE();
			const state = this.generateState();

			// Store pending request
			this.pendingRequests.set(state, {
				provider,
				codeVerifier: pkce.codeVerifier,
				createdAt: Date.now(),
				sourceId: options?.sourceId,
				tenantId: options?.tenantId,
				redirectUri,
			});

			// Clean up expired requests
			this.cleanupExpiredRequests();

			// Build authorization URL with local redirect URI
			const authUrl = this.buildAuthorizationUrl(provider, {
				clientId,
				codeChallenge: pkce.codeChallenge,
				state,
				tenantId: options?.tenantId || "common",
				redirectUri,
			});

			// Open browser
			window.open(authUrl);

			console.log(
				`[CalendarAuthManager] Started OAuth flow for ${provider} with redirect: ${redirectUri}`,
			);
		} catch (error) {
			console.error(
				`[CalendarAuthManager] Failed to start OAuth flow:`,
				error,
			);
			this.emit({
				type: "auth-error",
				provider,
				error:
					error instanceof Error ? error : new Error(String(error)),
			});
			new Notice(t("Failed to start authentication"));

			// Clean up server on error
			this.stopCallbackServer();
		}
	}

	// =========================================================================
	// Local Callback Server
	// =========================================================================

	/**
	 * Start local HTTP server to receive OAuth callback
	 * Google OAuth supports http://127.0.0.1 for desktop apps
	 */
	private async startCallbackServer(): Promise<string> {
		// Stop existing server if any
		await this.stopCallbackServer();

		return new Promise((resolve, reject) => {
			const tryPort = (port: number) => {
				if (port > OAUTH_CALLBACK_PORT_END) {
					reject(
						new Error(
							"Could not find available port for OAuth callback",
						),
					);
					return;
				}

				const server = http.createServer(
					(req: IncomingMessage, res: ServerResponse) => {
						this.handleHttpCallback(req, res);
					},
				);

				server.on("error", (err: NodeJS.ErrnoException) => {
					if (err.code === "EADDRINUSE") {
						// Port busy, try next
						tryPort(port + 1);
					} else {
						reject(err);
					}
				});

				server.listen(port, OAUTH_CALLBACK_HOST, () => {
					this.callbackServer = server;
					this.callbackPort = port;
					const redirectUri = `http://${OAUTH_CALLBACK_HOST}:${port}${OAUTH_CALLBACK_PATH}`;
					console.log(
						`[CalendarAuthManager] Callback server started on ${redirectUri}`,
					);
					resolve(redirectUri);
				});
			};

			tryPort(OAUTH_CALLBACK_PORT_START);
		});
	}

	/**
	 * Stop the local callback server
	 */
	private async stopCallbackServer(): Promise<void> {
		if (this.callbackServer) {
			return new Promise((resolve) => {
				this.callbackServer!.close(() => {
					this.callbackServer = null;
					this.callbackPort = 0;
					console.log(
						"[CalendarAuthManager] Callback server stopped",
					);
					resolve();
				});
			});
		}
	}

	/**
	 * Handle HTTP callback from OAuth provider
	 */
	private handleHttpCallback(
		req: IncomingMessage,
		res: ServerResponse,
	): void {
		const reqUrl = new URL(
			req.url || "/",
			`http://${OAUTH_CALLBACK_HOST}:${this.callbackPort}`,
		);

		if (reqUrl.pathname !== OAUTH_CALLBACK_PATH) {
			res.writeHead(404, { "Content-Type": "text/html" });
			res.end("<html><body><h1>Not Found</h1></body></html>");
			return;
		}

		// Extract query parameters
		const params: Record<string, string> = {};
		reqUrl.searchParams.forEach((value, key) => {
			params[key] = value;
		});

		// Send success page to browser
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(`
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<title>Authorization Complete</title>
				<style>
					body {
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
						display: flex;
						justify-content: center;
						align-items: center;
						height: 100vh;
						margin: 0;
						background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
						color: white;
					}
					.container {
						text-align: center;
						padding: 40px;
						background: rgba(255,255,255,0.1);
						border-radius: 16px;
						backdrop-filter: blur(10px);
					}
					h1 { margin-bottom: 16px; }
					p { opacity: 0.9; }
					.icon { font-size: 64px; margin-bottom: 20px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="icon">✓</div>
					<h1>Authorization Successful!</h1>
					<p>You can close this window and return to Obsidian.</p>
				</div>
				<script>
					// Auto-close after 3 seconds
					setTimeout(() => window.close(), 3000);
				</script>
			</body>
			</html>
		`);

		// Process the OAuth callback
		this.handleOAuthCallback(params);

		// Stop the server after a short delay
		setTimeout(() => this.stopCallbackServer(), 1000);
	}

	/**
	 * Handle OAuth callback from Obsidian protocol handler
	 */
	private async handleOAuthCallback(
		params: Record<string, string>,
	): Promise<void> {
		console.log(
			`[CalendarAuthManager] Received OAuth callback:`,
			Object.keys(params),
		);

		// Check for error response
		if (params.error) {
			const errorDescription = params.error_description || params.error;
			console.error(
				`[CalendarAuthManager] OAuth error:`,
				errorDescription,
			);
			new Notice(t("Authentication failed") + `: ${errorDescription}`);
			return;
		}

		const { code, state } = params;
		if (!code || !state) {
			console.warn(
				`[CalendarAuthManager] Missing code or state in callback`,
			);
			return;
		}

		// Validate state and retrieve pending request
		const pendingRequest = this.pendingRequests.get(state);
		if (!pendingRequest) {
			console.error(
				`[CalendarAuthManager] Invalid or expired state parameter`,
			);
			new Notice(t("Authentication session expired. Please try again."));
			return;
		}

		// Remove used state
		this.pendingRequests.delete(state);

		// Exchange code for tokens
		try {
			const tokens = await this.exchangeCodeForTokens(
				pendingRequest.provider,
				code,
				pendingRequest.codeVerifier,
				pendingRequest.redirectUri,
				pendingRequest.tenantId,
			);

			// Fetch user email if possible
			let email: string | undefined;
			try {
				email = await this.fetchUserEmail(
					pendingRequest.provider,
					tokens.accessToken,
				);
			} catch (e) {
				console.warn(
					`[CalendarAuthManager] Failed to fetch user email:`,
					e,
				);
			}

			this.emit({
				type: "auth-success",
				provider: pendingRequest.provider,
				tokens,
				email,
			});

			new Notice(
				t(
					`Successfully connected to ${pendingRequest.provider === "google" ? "Google" : "Outlook"} Calendar`,
				),
			);
		} catch (error) {
			console.error(
				`[CalendarAuthManager] Token exchange failed:`,
				error,
			);
			this.emit({
				type: "auth-error",
				provider: pendingRequest.provider,
				error:
					error instanceof Error ? error : new Error(String(error)),
			});
			new Notice(t("Failed to complete authentication"));
		}
	}

	/**
	 * Exchange authorization code for access and refresh tokens
	 */
	private async exchangeCodeForTokens(
		provider: "google" | "outlook",
		code: string,
		codeVerifier: string,
		redirectUri: string,
		tenantId?: string,
	): Promise<OAuthTokenData> {
		const config = OAUTH_PROVIDERS[provider];
		const clientId = this.clientConfigs[provider].clientId;

		// Build token URL (replace tenant placeholder for Outlook)
		let tokenUrl = config.tokenUrl;
		if (provider === "outlook") {
			tokenUrl = tokenUrl.replace("{tenant}", tenantId || "common");
		}

		// Build request body
		const body = new URLSearchParams({
			client_id: clientId,
			grant_type: "authorization_code",
			code,
			redirect_uri: redirectUri,
			code_verifier: codeVerifier,
		});

		// Add client_secret if available (required by Google even for Desktop apps)
		if (config.clientSecret) {
			body.set("client_secret", config.clientSecret);
		}

		console.log("[CalendarAuthManager] Token exchange request:", {
			url: tokenUrl,
			clientId: clientId.substring(0, 20) + "...",
			redirectUri,
			codeVerifierLength: codeVerifier.length,
		});

		let response;
		try {
			response = await requestUrl({
				url: tokenUrl,
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: body.toString(),
				throw: false, // Don't throw on non-2xx status
			});
		} catch (error: unknown) {
			// requestUrl throws on network errors or non-2xx status
			console.error(
				"[CalendarAuthManager] Token exchange request error:",
				error,
			);
			const errMsg =
				error instanceof Error ? error.message : String(error);
			throw new Error(`Token exchange network error: ${errMsg}`);
		}

		console.log(
			"[CalendarAuthManager] Token exchange response status:",
			response.status,
		);

		if (response.status !== 200) {
			let errorData;
			try {
				errorData = response.json;
			} catch {
				errorData = { raw: response.text };
			}
			console.error(
				"[CalendarAuthManager] Token exchange error response:",
				errorData,
			);
			throw new Error(
				`Token exchange failed: ${errorData?.error_description || errorData?.error || response.status}`,
			);
		}

		const data = response.json;
		const now = Date.now();

		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: now + data.expires_in * 1000,
			scope: data.scope || config.defaultScopes.join(" "),
			tokenType: data.token_type || "Bearer",
			issuedAt: now,
		};
	}

	/**
	 * Refresh an expired access token using the refresh token
	 */
	async refreshAccessToken(
		provider: "google" | "outlook",
		refreshToken: string,
		tenantId?: string,
	): Promise<OAuthTokenData> {
		const config = OAUTH_PROVIDERS[provider];
		const clientId = this.clientConfigs[provider].clientId;

		if (!clientId) {
			throw new Error(`OAuth client ID not configured for ${provider}`);
		}

		// Build token URL
		let tokenUrl = config.tokenUrl;
		if (provider === "outlook") {
			tokenUrl = tokenUrl.replace("{tenant}", tenantId || "common");
		}

		const body = new URLSearchParams({
			client_id: clientId,
			grant_type: "refresh_token",
			refresh_token: refreshToken,
		});

		// Add client_secret if available (required by Google even for Desktop apps)
		if (config.clientSecret) {
			body.set("client_secret", config.clientSecret);
		}

		const response = await requestUrl({
			url: tokenUrl,
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: body.toString(),
		});

		if (response.status !== 200) {
			const errorData = response.json;
			throw new Error(
				`Token refresh failed: ${errorData?.error_description || errorData?.error || response.status}`,
			);
		}

		const data = response.json;
		const now = Date.now();

		const newTokens: OAuthTokenData = {
			accessToken: data.access_token,
			// Some providers rotate refresh tokens, some don't
			refreshToken: data.refresh_token || refreshToken,
			expiresAt: now + data.expires_in * 1000,
			scope: data.scope || config.defaultScopes.join(" "),
			tokenType: data.token_type || "Bearer",
			issuedAt: now,
		};

		this.emit({ type: "token-refreshed", provider, tokens: newTokens });
		return newTokens;
	}

	/**
	 * Revoke OAuth tokens (disconnect from provider)
	 */
	async revokeTokens(
		provider: "google" | "outlook",
		tokens: OAuthTokenData,
	): Promise<void> {
		try {
			if (provider === "google" && OAUTH_PROVIDERS.google.revokeUrl) {
				// Google supports token revocation
				await requestUrl({
					url: `${OAUTH_PROVIDERS.google.revokeUrl}?token=${tokens.accessToken}`,
					method: "POST",
				});
			}
			// Outlook doesn't have a simple revocation endpoint for public clients
			// Users need to revoke access through their Microsoft account settings

			this.emit({ type: "disconnected", provider });
		} catch (error) {
			console.warn(
				`[CalendarAuthManager] Token revocation failed:`,
				error,
			);
			// Still emit disconnected - tokens are being removed locally
			this.emit({ type: "disconnected", provider });
		}
	}

	// =========================================================================
	// Token Utilities
	// =========================================================================

	/**
	 * Check if token data is expired or about to expire
	 */
	isTokenExpired(tokenData: OAuthTokenData): boolean {
		return Date.now() > tokenData.expiresAt - TOKEN_REFRESH_BUFFER_MS;
	}

	/**
	 * Check if token can be refreshed (has refresh token)
	 */
	canRefreshToken(tokenData: OAuthTokenData): boolean {
		return !!tokenData.refreshToken;
	}

	/**
	 * Ensure token is valid, refreshing if necessary
	 */
	async ensureValidToken(
		provider: "google" | "outlook",
		tokenData: OAuthTokenData,
		tenantId?: string,
	): Promise<OAuthTokenData> {
		if (!this.isTokenExpired(tokenData)) {
			return tokenData;
		}

		if (!this.canRefreshToken(tokenData)) {
			throw new Error("Token expired and no refresh token available");
		}

		return this.refreshAccessToken(
			provider,
			tokenData.refreshToken,
			tenantId,
		);
	}

	// =========================================================================
	// PKCE Implementation
	// =========================================================================

	/**
	 * Generate PKCE code verifier and challenge
	 */
	private async generatePKCE(): Promise<PKCEData> {
		const codeVerifier = this.generateRandomString(64);
		const codeChallenge = await this.sha256Base64Url(codeVerifier);
		const state = this.generateRandomString(32);

		return { codeVerifier, codeChallenge, state };
	}

	/**
	 * Generate a random URL-safe string
	 */
	private generateRandomString(length: number): string {
		const array = new Uint8Array(length);
		crypto.getRandomValues(array);
		return this.base64UrlEncode(array);
	}

	/**
	 * Generate state parameter for CSRF protection
	 */
	private generateState(): string {
		return this.generateRandomString(32);
	}

	/**
	 * Compute SHA-256 hash and encode as base64url
	 */
	private async sha256Base64Url(input: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(input);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		return this.base64UrlEncode(new Uint8Array(hashBuffer));
	}

	/**
	 * Encode bytes as base64url (RFC 4648)
	 */
	private base64UrlEncode(bytes: Uint8Array): string {
		let binary = "";
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary)
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
	}

	// =========================================================================
	// URL Building
	// =========================================================================

	/**
	 * Build the OAuth authorization URL
	 */
	private buildAuthorizationUrl(
		provider: "google" | "outlook",
		params: {
			clientId: string;
			codeChallenge: string;
			state: string;
			tenantId?: string;
			redirectUri: string;
		},
	): string {
		const config = OAUTH_PROVIDERS[provider];

		// Build base URL (replace tenant for Outlook)
		let authUrl = config.authorizationUrl;
		if (provider === "outlook") {
			authUrl = authUrl.replace("{tenant}", params.tenantId || "common");
		}

		const searchParams = new URLSearchParams({
			client_id: params.clientId,
			redirect_uri: params.redirectUri,
			response_type: "code",
			scope: config.defaultScopes.join(" "),
			code_challenge: params.codeChallenge,
			code_challenge_method: "S256",
			state: params.state,
		});

		// Provider-specific parameters
		if (provider === "google") {
			// Request offline access to get refresh token
			searchParams.set("access_type", "offline");
			// Force consent screen to ensure we get refresh token
			searchParams.set("prompt", "consent");
		}

		if (provider === "outlook") {
			// Outlook may require prompt for certain scenarios
			searchParams.set("prompt", "select_account");
		}

		return `${authUrl}?${searchParams.toString()}`;
	}

	// =========================================================================
	// User Info
	// =========================================================================

	/**
	 * Fetch user email from provider
	 */
	private async fetchUserEmail(
		provider: "google" | "outlook",
		accessToken: string,
	): Promise<string | undefined> {
		const config = OAUTH_PROVIDERS[provider];
		if (!config.userInfoUrl) return undefined;

		const response = await requestUrl({
			url: config.userInfoUrl,
			method: "GET",
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		if (response.status !== 200) {
			throw new Error(`Failed to fetch user info: ${response.status}`);
		}

		const data = response.json;

		if (provider === "google") {
			return data.email;
		} else if (provider === "outlook") {
			return data.mail || data.userPrincipalName;
		}

		return undefined;
	}

	// =========================================================================
	// Request Management
	// =========================================================================

	/**
	 * Clean up expired pending requests
	 */
	private cleanupExpiredRequests(): void {
		const now = Date.now();
		for (const [state, request] of this.pendingRequests.entries()) {
			if (now - request.createdAt > PENDING_REQUEST_TIMEOUT_MS) {
				this.pendingRequests.delete(state);
			}
		}
	}

	// =========================================================================
	// Event System
	// =========================================================================

	/**
	 * Add event listener
	 */
	on(callback: EventCallback): void {
		this.eventListeners.push(callback);
	}

	/**
	 * Remove event listener
	 */
	off(callback: EventCallback): void {
		const index = this.eventListeners.indexOf(callback);
		if (index !== -1) {
			this.eventListeners.splice(index, 1);
		}
	}

	/**
	 * Emit event to all listeners
	 */
	private emit(event: AuthManagerEvent): void {
		for (const listener of this.eventListeners) {
			try {
				listener(event);
			} catch (error) {
				console.error(
					`[CalendarAuthManager] Event listener error:`,
					error,
				);
			}
		}
	}

	// =========================================================================
	// Cleanup
	// =========================================================================

	override onunload(): void {
		// Stop callback server if running
		this.stopCallbackServer();

		this.pendingRequests.clear();
		this.eventListeners = [];
		super.onunload();
	}
}
