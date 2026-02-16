import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { CookieJar, Cookie } from 'tough-cookie';
// Note: We don't use axios-cookiejar-support's wrapper because it has a bug
// where cookies get stored with incorrect paths (including query strings)
import crypto from 'crypto';
import * as cheerio from 'cheerio';
import { LibrarySystemConfig, SYSTEM_CONFIG } from './library-system.js';

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
  private readonly SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours
  private readonly config: LibrarySystemConfig;
  private readonly sessions: Map<string, HttpAuthSession> = new Map();

  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  constructor(config: LibrarySystemConfig) {
    this.config = config;
  }

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
   * Store cookies exactly as received from the server (no decoding).
   * Fixes axios-cookiejar-support bug where paths include query strings.
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
        // Store cookie value exactly as received from server
        // Do NOT decode - the server may expect the encoded value
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
        console.warn('[HttpAuth] Failed to parse cookie:', cookieStr.substring(0, 50), e);
      }
    }
  }

  /**
   * Get cookie header string for a request URL.
   * Send cookie values exactly as received - do NOT decode.
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
      
      // VERBOSE: Log set-cookie headers
      const setCookies = response.headers['set-cookie'];
      if (setCookies) {
        console.log(`[HttpAuth] Set-Cookie from ${new URL(currentUrl).hostname}:`);
        for (const c of setCookies) {
          console.log(`  ${c}`);
        }
      }
      
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
   * Authenticate with a default or provided booking URL
   * For specific bookings, use loginForBooking() instead
   */
  async login(credentials: AuthCredentials, bookingUrl?: string): Promise<HttpAuthResponse> {
    console.log('[HttpAuth] Starting HTTP-based authentication (using default booking page)...');

    const url = bookingUrl || this.getDefaultBookingUrl();
    if (!url) {
      return {
        success: false,
        sessionId: '',
        expiresAt: 0,
        libraryCard: credentials.libraryCard,
        error: 'No default booking URL available for this system'
      };
    }

    return this.loginForBooking(credentials, url);
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
      
      // Log the RAW location header to see if ? is present
      console.log('[HttpAuth] RAW Location header analysis:');
      const rawTarget = linkerUrl.split('target=')[1] || '';
      console.log(`  Raw target (from split): ${rawTarget}`);
      console.log(`  Raw has ?: ${rawTarget.includes('?')}`);
      console.log(`  Raw has /: ${rawTarget.includes('/')}`);
      
      // Extract and log the target parameter to compare with dest cookie later
      // NOTE: URL.searchParams.get() may URL-decode the value!
      const linkerUrlObj = new URL(linkerUrl);
      const targetParam = linkerUrlObj.searchParams.get('target') || '';
      console.log('[HttpAuth] Target from URL.searchParams.get():');
      console.log(`  Parsed: ${targetParam}`);
      console.log(`  Parsed has ?: ${targetParam.includes('?')}`);
      console.log(`  Parsed has /: ${targetParam.includes('/')}`);
      
      // Compare raw vs parsed
      console.log(`[HttpAuth] Raw vs Parsed MATCH: ${rawTarget === targetParam}`);

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

      // Log ALL cookies in the jar for debugging
      const allCookies = await this.getAllCookiesFromJar(jar);
      console.log('[HttpAuth] All cookies in jar:');
      for (const c of allCookies) {
        console.log(`  ${c.domain} | ${c.key} | path=${c.path}`);
        // Log the dest cookie value to verify it's our booking URL
        if (c.key === 'dest') {
          console.log(`  [dest raw]: ${c.value}`);
          try {
            // Use base64url decoding (replace _ with / and - with +)
            const base64 = c.value.replace(/_/g, '/').replace(/-/g, '+');
            const decoded = Buffer.from(base64, 'base64').toString('utf8');
            console.log(`  [dest decoded]: ${decoded}`);
          } catch (e) {
            console.log(`  [dest decode error]: ${e}`);
          }
        }
      }

      // Log cookies after loading form
      const cookiesAfterForm = await jar.getCookies(new URL(this.config.loginCallbackUrl).origin + '/');
      const libAuthCookies = await jar.getCookies('https://libauth.com/');
      console.log(`[HttpAuth] ${this.config.id} cookies:`, cookiesAfterForm.map(c => c.key).join(', '));
      console.log('[HttpAuth] LibAuth cookies:', libAuthCookies.map(c => c.key).join(', '));

      // Step 3: POST credentials to libauth.com/form_login
      console.log('[HttpAuth] Step 3: Submitting credentials...');
      
      // The login_url parameter must be the libapps callback URL
      // This is where libauth.com redirects after successful auth
      // The callback then redirects to the original booking URL with the token
      const loginCallbackUrl = this.config.loginCallbackUrl;
      
      console.log('[HttpAuth] Using login_url:', loginCallbackUrl);
      
      const postBody = `auth_id=${this.config.authId}&login_url=${encodeURIComponent(loginCallbackUrl)}&username=${encodeURIComponent(credentials.libraryCard)}&password=${encodeURIComponent(credentials.pin)}`;
      
      console.log('[HttpAuth] POST body (full):', postBody);

      // Get cookies for the POST request
      const postCookies = await this.getCookieHeader(jar, this.config.authPostUrl);
      console.log('[HttpAuth] ===== COOKIES FOR POST =====');
      console.log('[HttpAuth] Cookie header length:', postCookies ? postCookies.length : 0);
      console.log('[HttpAuth] Full cookie string:');
      console.log(postCookies);
      
      // Extract and log the dest cookie value specifically for debugging
      const destMatch = postCookies.match(/dest=([^;]+)/);
      if (destMatch) {
        console.log('[HttpAuth] dest cookie value being sent:');
        console.log(`  Raw: ${destMatch[1]}`);
        console.log(`  Includes %2F: ${destMatch[1].includes('%2F')}`);
        console.log(`  Includes ?: ${destMatch[1].includes('?')}`);
      }
      console.log('[HttpAuth] ===== END COOKIES =====');

      const postHeaders = {
        ...this.getBaseHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postBody.length.toString(),
        'Origin': new URL(this.config.loginCallbackUrl).origin,
        'Referer': formUrl,
        'Cache-Control': 'max-age=0',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-user': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cookie': postCookies,
      };
      
      console.log('[HttpAuth] ===== POST REQUEST HEADERS =====');
      for (const [key, value] of Object.entries(postHeaders)) {
        if (key === 'Cookie') {
          console.log(`  ${key}: (see above)`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }
      console.log('[HttpAuth] ===== END HEADERS =====');

      const authResponse = await client.post(this.config.authPostUrl, postBody, {
        headers: postHeaders,
      });
      
      console.log('[HttpAuth] ===== POST RESPONSE =====');
      console.log('[HttpAuth] Status:', authResponse.status, authResponse.statusText);
      console.log('[HttpAuth] Response headers:');
      for (const [key, value] of Object.entries(authResponse.headers)) {
        console.log(`  ${key}: ${value}`);
      }
      console.log('[HttpAuth] ===== END RESPONSE =====');
      
      // Store cookies from auth response
      await this.storeCookiesFromResponse(jar, authResponse, this.config.authPostUrl);

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

          this.sessions.set(sessionId, session);

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
          // No token in direct redirect - check if this is a callback URL with result=0
          // If so, we need to follow the redirect to get the actual booking URL with token
          if (redirectUrl.includes('result=0')) {
            console.log('[HttpAuth] Got result=0, following callback to get token...');
            
            // Follow the callback redirect chain with proper headers
            const callbackHeaders = {
              'User-Agent': this.USER_AGENT,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://libauth.com/',
            };
            
            const { finalUrl, response: callbackResponse } = await this.followRedirects(
              client,
              jar,
              redirectUrl,
              callbackHeaders,
              10
            );
            
            console.log('[HttpAuth] Callback final URL:', finalUrl);
            console.log('[HttpAuth] Callback response status:', callbackResponse.status);
            
            // Check if the final URL has a token
            const finalUrlObj = new URL(finalUrl);
            const finalToken = finalUrlObj.searchParams.get('token');
            
            if (finalToken) {
              console.log('[HttpAuth] ✅ Token found after following callback!');
              
              const sessionId = this.generateSessionId();
              const expiresAt = Date.now() + this.SESSION_DURATION;

              const session: HttpAuthSession = {
                sessionId,
                cookieJar: jar,
                expiresAt,
                libraryCard: credentials.libraryCard,
                token: finalToken,
                bookingUrl: finalUrl,
              };

              this.sessions.set(sessionId, session);

              return {
                success: true,
                sessionId,
                expiresAt,
                libraryCard: credentials.libraryCard,
                token: finalToken,
              };
            }
            
            console.error('[HttpAuth] ❌ No token found even after following callback');
            console.error('[HttpAuth] Final URL was:', finalUrl);
          }
          
          console.error('[HttpAuth] ❌ Redirect received but no token found');
          console.error('[HttpAuth] Redirect URL was:', redirectUrl);
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
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Check if session expired
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Get all active sessions (for debugging)
   */
  getAllSessions(): Map<string, HttpAuthSession> {
    return this.sessions;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Logout and destroy session
   */
  logout(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
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

  getDefaultBookingUrl(date?: string): string | null {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const path = this.config.defaultBookingPath(targetDate);
    if (!path) {
      return null;
    }
    return new URL(path, this.config.baseUrl).toString();
  }
}

const authServices: Record<'kcls' | 'seattle', HttpAuthService> = {
  kcls: new HttpAuthService(SYSTEM_CONFIG.kcls),
  seattle: new HttpAuthService(SYSTEM_CONFIG.seattle)
};

export function getAuthService(system: 'kcls' | 'seattle'): HttpAuthService {
  return authServices[system] || authServices.kcls;
}

// Cleanup expired sessions every 15 minutes
setInterval(() => {
  Object.values(authServices).forEach(service => service.cleanupExpiredSessions());
}, 15 * 60 * 1000);
