import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { CookieJar, Cookie } from 'tough-cookie';
// Note: We don't use axios-cookiejar-support's wrapper because it has a bug
// where cookies get stored with incorrect paths (including query strings)
import crypto from 'crypto';
import * as cheerio from 'cheerio';

export interface AuthCredentials {
  libraryCard: string;
  pin: string;
}

export interface HttpAuthSession {
  sessionId: string;
  cookieJar: CookieJar;
  expiresAt: number;
  libraryCard: string;
  token?: string; // Auth token from redirect
  bookingUrl?: string; // Full booking URL with token from redirect
}

export interface HttpAuthResponse {
  success: boolean;
  sessionId: string;
  expiresAt: number;
  libraryCard: string;
  token?: string;
  error?: string;
}

// Store active sessions in memory (in production, use Redis or similar)
const httpSessions = new Map<string, HttpAuthSession>();

/**
 * HTTP-based authentication service that replaces Puppeteer browser automation
 * Uses axios with cookie jar support to maintain session across requests
 * 
 * Authentication flow:
 * 1. GET booking page -> 302 redirect to libauth.com/linker with target
 * 2. GET libauth.com/linker -> 307 redirect to kcls.libapps.com/libapps/libauth
 * 3. GET login form page -> 200 (sets up session cookies)
 * 4. POST form_login with credentials -> 303 redirect back to booking with token
 */
class HttpAuthService {
  private readonly AUTH_POST_URL = 'https://libauth.com/form_login';
  private readonly AUTH_ID = '1963';
  private readonly LOGIN_CALLBACK_URL = 'https://kcls.libapps.com/libapps/libauth?auth_id=1963';
  private readonly SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours

  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  /**
   * Create a configured axios client (without cookie jar wrapper)
   * We handle cookies manually to fix a bug in axios-cookiejar-support
   * where cookie paths include query strings incorrectly
   */
  private createClient(): AxiosInstance {
    return axios.create({
      timeout: 30000,
      maxRedirects: 0, // Handle redirects manually to track flow
      validateStatus: () => true, // Accept all status codes so we can handle redirects
    });
  }

  /**
   * Store cookies from response headers with correct path
   * Fixes axios-cookiejar-support bug where paths include query strings
   */
  private async storeCookiesFromResponse(
    jar: CookieJar,
    response: AxiosResponse,
    requestUrl: string
  ): Promise<void> {
    const setCookieHeaders = response.headers['set-cookie'];
    if (!setCookieHeaders) return;

    const urlObj = new URL(requestUrl);
    
    for (const cookieStr of setCookieHeaders) {
      try {
        const cookie = Cookie.parse(cookieStr);
        if (cookie) {
          // Force path to "/" if not explicitly set in the cookie string
          // This fixes the bug where axios stores cookies with query strings as path
          if (!cookieStr.toLowerCase().includes('path=')) {
            cookie.path = '/';
          }
          // Ensure domain is set correctly
          if (!cookie.domain) {
            cookie.domain = urlObj.hostname;
          }
          await jar.setCookie(cookie, requestUrl);
        }
      } catch (e) {
        console.warn('[HttpAuth] Failed to parse cookie:', cookieStr.substring(0, 50));
      }
    }
  }

  /**
   * Get cookie header string for a request URL
   */
  private async getCookieHeader(jar: CookieJar, url: string): Promise<string> {
    return await jar.getCookieString(url);
  }

  /**
   * Follow redirects manually to track the authentication flow
   * Also stores cookies correctly from each response
   */
  private async followRedirects(
    client: AxiosInstance,
    jar: CookieJar,
    url: string,
    headers: Record<string, string>,
    maxRedirects: number = 10
  ): Promise<{ finalUrl: string; response: AxiosResponse }> {
    let currentUrl = url;
    let response: AxiosResponse;
    let redirectCount = 0;

    while (redirectCount < maxRedirects) {
      // Add cookies to request
      const cookieHeader = await this.getCookieHeader(jar, currentUrl);
      const requestHeaders = { ...headers };
      if (cookieHeader) {
        requestHeaders['Cookie'] = cookieHeader;
      }

      response = await client.get(currentUrl, { headers: requestHeaders });
      
      // Store cookies from response with correct paths
      await this.storeCookiesFromResponse(jar, response, currentUrl);
      
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        const location = response.headers.location as string;
        // Handle relative URLs
        if (location.startsWith('/')) {
          const urlObj = new URL(currentUrl);
          currentUrl = `${urlObj.protocol}//${urlObj.host}${location}`;
        } else {
          currentUrl = location;
        }
        console.log(`[HttpAuth] Redirect ${response.status}: ${currentUrl.substring(0, 100)}...`);
        redirectCount++;
      } else {
        return { finalUrl: currentUrl, response };
      }
    }

    throw new Error('Too many redirects');
  }

  /**
   * Authenticate with KCLS library card using pure HTTP requests
   * This uses a default museum booking page to trigger the auth flow
   * For specific bookings, use loginForBooking() instead
   */
  async login(credentials: AuthCredentials): Promise<HttpAuthResponse> {
    console.log('[HttpAuth] Starting HTTP-based authentication (using default booking page)...');
    
    // Use a valid booking URL that triggers authentication
    // The /book endpoint requires auth, so it redirects to login
    // Using MOPOP museum ID: 33c1f0af9b02
    const today = new Date().toISOString().split('T')[0];
    const defaultBookingUrl = `https://rooms.kcls.org/passes/33c1f0af9b02/book?date=${today}&pass=anypass&digital=1&physical=0&location=0`;
    
    return this.loginForBooking(credentials, defaultBookingUrl);
  }

  /**
   * Authenticate and get a session ready for a specific booking URL
   * This follows the exact flow discovered from HAR analysis:
   * 1. GET booking page -> 302 redirect to libauth.com/linker?target={base64_encoded_url}
   * 2. GET linker -> 307 redirect to kcls.libapps.com/libapps/libauth
   * 3. GET login form -> 200 (establishes session)
   * 4. POST form_login -> 303 redirect back to booking with token
   */
  async loginForBooking(
    credentials: AuthCredentials,
    bookingUrl: string
  ): Promise<HttpAuthResponse> {
    console.log('[HttpAuth] Starting booking-based authentication flow...');
    console.log('[HttpAuth] Target booking URL:', bookingUrl);
    console.log('[HttpAuth] Library card:', credentials.libraryCard);

    try {
      const jar = new CookieJar();
      const client = this.createClient();

      // Step 1: Start from the booking page - this will redirect through the auth flow
      console.log('[HttpAuth] Step 1: Accessing booking page (will redirect to login)...');
      
      // Do NOT follow redirects fully - we just want to get the linker URL
      const bookingResponse = await client.get(bookingUrl, {
        headers: this.getBaseHeaders(),
      });
      
      // Store cookies from booking response
      await this.storeCookiesFromResponse(jar, bookingResponse, bookingUrl);
      
      console.log('[HttpAuth] Booking page status:', bookingResponse.status);
      
      // We should get a 302 redirect to libauth.com/linker
      if (bookingResponse.status !== 302 || !bookingResponse.headers.location) {
        console.error('[HttpAuth] Unexpected: booking page did not redirect');
        console.error('[HttpAuth] Status:', bookingResponse.status);
        return {
          success: false,
          sessionId: '',
          expiresAt: 0,
          libraryCard: credentials.libraryCard,
          error: 'Booking page did not redirect to login',
        };
      }

      const linkerUrl = bookingResponse.headers.location as string;
      console.log('[HttpAuth] Linker URL:', linkerUrl.substring(0, 100) + '...');

      // Step 2: Follow the linker URL to get the auth form page
      console.log('[HttpAuth] Step 2: Following linker to auth form...');
      const { finalUrl: formUrl, response: formResponse } = await this.followRedirects(
        client,
        jar,
        linkerUrl,
        this.getBaseHeaders()
      );
      
      console.log('[HttpAuth] Form page URL:', formUrl.substring(0, 80) + '...');
      console.log('[HttpAuth] Form page status:', formResponse.status);

      // Log cookies after loading form
      const cookiesAfterForm = await jar.getCookies('https://kcls.libapps.com/');
      const libAuthCookies = await jar.getCookies('https://libauth.com/');
      console.log('[HttpAuth] KCLS cookies:', cookiesAfterForm.map(c => c.key).join(', '));
      console.log('[HttpAuth] LibAuth cookies:', libAuthCookies.map(c => c.key).join(', '));

      // Step 3: POST credentials to libauth.com/form_login
      console.log('[HttpAuth] Step 3: Submitting credentials...');
      
      // The login_url should be exactly: https://kcls.libapps.com/libapps/libauth?auth_id=1963
      // Using the constant to ensure we match what the server expects
      const loginCallbackUrl = `https://kcls.libapps.com/libapps/libauth?auth_id=${this.AUTH_ID}`;
      
      console.log('[HttpAuth] Using login_url:', loginCallbackUrl);
      
      const postBody = `auth_id=${this.AUTH_ID}&login_url=${encodeURIComponent(loginCallbackUrl)}&username=${encodeURIComponent(credentials.libraryCard)}&password=${encodeURIComponent(credentials.pin)}`;
      
      console.log('[HttpAuth] POST body (redacted):', `auth_id=${this.AUTH_ID}&login_url=...&username=${credentials.libraryCard}&password=****`);

      // Get cookies for the POST request
      const postCookies = await this.getCookieHeader(jar, this.AUTH_POST_URL);
      console.log('[HttpAuth] Cookies for POST:', postCookies ? `${postCookies.length} chars` : 'NONE');

      const authResponse = await client.post(this.AUTH_POST_URL, postBody, {
        headers: {
          ...this.getBaseHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postBody.length.toString(),
          'Origin': 'https://kcls.libapps.com',
          'Referer': formUrl,
          'Cache-Control': 'max-age=0',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'cross-site',
          'sec-fetch-user': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Cookie': postCookies,
        },
      });
      
      // Store cookies from auth response
      await this.storeCookiesFromResponse(jar, authResponse, this.AUTH_POST_URL);

      console.log('[HttpAuth] Auth response status:', authResponse.status);

      // Check for redirect with token
      if (authResponse.status === 303 && authResponse.headers.location) {
        const redirectUrl = authResponse.headers.location as string;
        console.log('[HttpAuth] Redirect URL:', redirectUrl);

        // Extract token from redirect URL
        const urlObj = new URL(redirectUrl);
        const token = urlObj.searchParams.get('token');

        if (token) {
          console.log('[HttpAuth] ✅ Token extracted successfully');

          // NOTE: Do NOT follow the redirect here!
          // The token is single-use - if we access the booking page now, it will be consumed
          // Instead, we store the redirect URL and use it later during actual booking
          console.log('[HttpAuth] Storing booking URL for later use (token is single-use)');

          // Create session
          const sessionId = this.generateSessionId();
          const expiresAt = Date.now() + this.SESSION_DURATION;

          const session: HttpAuthSession = {
            sessionId,
            cookieJar: jar,
            expiresAt,
            libraryCard: credentials.libraryCard,
            token,
            bookingUrl: redirectUrl, // Store the full booking URL with token
          };

          httpSessions.set(sessionId, session);

          // Log all cookies we have now
          const allCookies = await this.getAllCookiesFromJar(jar);
          console.log('[HttpAuth] Total cookies established:', allCookies.length);
          console.log('[HttpAuth] Cookie domains:', [...new Set(allCookies.map(c => c.domain))].join(', '));

          console.log(`[HttpAuth] ✅ Authentication successful for ${credentials.libraryCard}`);
          console.log(`[HttpAuth] Session ID: ${sessionId}`);

          return {
            success: true,
            sessionId,
            expiresAt,
            libraryCard: credentials.libraryCard,
            token,
          };
        } else {
          console.error('[HttpAuth] ❌ Redirect received but no token found');
          return {
            success: false,
            sessionId: '',
            expiresAt: 0,
            libraryCard: credentials.libraryCard,
            error: 'Authentication redirect missing token',
          };
        }
      }

      // Check for error in response
      if (typeof authResponse.data === 'string') {
        const $ = cheerio.load(authResponse.data);
        const errorMsg = $('.alert-danger, .error, .form-error').text().trim();
        if (errorMsg) {
          console.error('[HttpAuth] ❌ Error message:', errorMsg);
          return {
            success: false,
            sessionId: '',
            expiresAt: 0,
            libraryCard: credentials.libraryCard,
            error: errorMsg,
          };
        }
      }

      console.error('[HttpAuth] ❌ Unexpected response status:', authResponse.status);
      return {
        success: false,
        sessionId: '',
        expiresAt: 0,
        libraryCard: credentials.libraryCard,
        error: 'Invalid library card or PIN',
      };

    } catch (error: any) {
      console.error('[HttpAuth] ❌ Authentication error:', error.message);
      if (error.response) {
        console.error('[HttpAuth] Response status:', error.response.status);
      }
      return {
        success: false,
        sessionId: '',
        expiresAt: 0,
        libraryCard: credentials.libraryCard,
        error: error.message || 'Authentication failed',
      };
    }
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): HttpAuthSession | null {
    const session = httpSessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Check if session expired
    if (Date.now() > session.expiresAt) {
      httpSessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Get all active sessions (for debugging)
   */
  getAllSessions(): Map<string, HttpAuthSession> {
    return httpSessions;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    return httpSessions.delete(sessionId);
  }

  /**
   * Logout and destroy session
   */
  logout(sessionId: string): boolean {
    return httpSessions.delete(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of httpSessions.entries()) {
      if (now > session.expiresAt) {
        httpSessions.delete(sessionId);
        console.log(`[HttpAuth] Cleaned up expired session: ${sessionId}`);
      }
    }
  }

  /**
   * Get all cookies from a cookie jar
   */
  private async getAllCookiesFromJar(jar: CookieJar): Promise<any[]> {
    return new Promise((resolve) => {
      if (jar.store.getAllCookies) {
        jar.store.getAllCookies((err, cookies) => {
          resolve(cookies || []);
        });
      } else {
        resolve([]);
      }
    });
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get base headers for HTTP requests
   */
  private getBaseHeaders(): Record<string, string> {
    return {
      'User-Agent': this.USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1',
      'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    };
  }
}

// Export singleton instance
export const httpAuthService = new HttpAuthService();

// Export the sessions map for use by booking service
export { httpSessions };

// Cleanup expired sessions every 15 minutes
setInterval(() => {
  httpAuthService.cleanupExpiredSessions();
}, 15 * 60 * 1000);
