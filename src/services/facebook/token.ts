export interface TokenDebugInfo {
  isValid: boolean;
  type?: string;
  appId?: string;
  expiresAt?: Date | null; // null or 0 = never expires
  scopes: string[];
  error?: string;
}

export class FacebookTokenService {
  /**
   * Inspects a Facebook access token using Graph API debug_token endpoint
   */
  public static async inspectToken(accessToken: string): Promise<TokenDebugInfo> {
    try {
      const url = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(
        accessToken
      )}&access_token=${encodeURIComponent(accessToken)}`;

      const response = await fetch(url);
      const data = await response.json() as any;

      if (!response.ok || data.error) {
        return {
          isValid: false,
          scopes: [],
          error: data.error?.message || `HTTP ${response.status}: Failed to debug token`,
        };
      }

      const tokenData = data.data;
      const expiresAt =
        tokenData.expires_at === 0 || !tokenData.expires_at
          ? null // Never expires
          : new Date(tokenData.expires_at * 1000);

      return {
        isValid: tokenData.is_valid,
        type: tokenData.type,
        appId: tokenData.app_id,
        expiresAt,
        scopes: tokenData.scopes || [],
      };
    } catch (err: any) {
      return {
        isValid: false,
        scopes: [],
        error: err.message || 'Unknown network error during token inspection',
      };
    }
  }

  /**
   * Checks if a token is nearing expiry (within N days)
   */
  public static isExpiringSoon(expiresAt: Date | null | undefined, daysThreshold: number = 7): boolean {
    if (!expiresAt) return false; // Never expires
    const msThreshold = daysThreshold * 24 * 60 * 60 * 1000;
    return expiresAt.getTime() - Date.now() < msThreshold;
  }
}

