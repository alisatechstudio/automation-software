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

  /**
   * Exchanges a short-lived user token for a long-lived user token,
   * then fetches permanent (never-expiring) Page Access Tokens.
   */
  public static async getPermanentPageTokens(
    shortLivedUserToken: string,
    appId: string,
    appSecret: string
  ): Promise<Array<{ id: string; name: string; accessToken: string }>> {
    // 1. Exchange short-lived user token for 60-day long-lived user token
    const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
      appId.trim()
    )}&client_secret=${encodeURIComponent(appSecret.trim())}&fb_exchange_token=${encodeURIComponent(
      shortLivedUserToken.trim()
    )}`;

    const res1 = await fetch(exchangeUrl);
    const data1 = (await res1.json()) as any;

    if (!res1.ok || !data1.access_token) {
      throw new Error(data1.error?.message || 'Failed to exchange for long-lived user token');
    }

    const longLivedUserToken = data1.access_token;

    // 2. Fetch pages using long-lived user token.
    // Page tokens fetched using a long-lived user token NEVER expire!
    const accountsUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(
      longLivedUserToken
    )}`;

    const res2 = await fetch(accountsUrl);
    const data2 = (await res2.json()) as any;

    if (!res2.ok || !data2.data) {
      throw new Error(data2.error?.message || 'Failed to retrieve page accounts');
    }

    return data2.data.map((item: any) => ({
      id: item.id,
      name: item.name,
      accessToken: item.access_token,
    }));
  }
}

