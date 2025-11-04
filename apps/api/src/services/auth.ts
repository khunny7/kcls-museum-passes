import axios, { AxiosInstance } from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import crypto from 'crypto';

export interface AuthCredentials {
  libraryCard: string;
  pin: string;
}

export interface AuthSession {
  sessionId: string;
  cookieJar: CookieJar;
  expiresAt: number;
  libraryCard: string;
}

export interface AuthResponse {
  success: boolean;
  sessionId: string;
  expiresAt: number;
  libraryCard: string;
  token?: string; // Authentication token from redirect URL
  error?: string;
}

// Store active sessions in memory (in production, use Redis or similar)
const activeSessions = new Map<string, AuthSession>();

class AuthService {
  private readonly AUTH_FORM_URL = 'https://kcls.libapps.com/libapps/libauth?auth_id=1963';
  private readonly AUTH_POST_URL = 'https://libauth.com/form_login';
  private readonly AUTH_ID = '1963';
  private readonly LOGIN_CALLBACK_URL = 'https://kcls.libapps.com/libapps/libauth?auth_id=1963';
  private readonly SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours

  /**
   * Authenticate with KCLS library card
   */
  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    try {
      // Create axios instance with cookie jar
      const jar = new CookieJar();
      const client = wrapper(axios.create({ jar }));

      // Step 1: GET to kcls.libapps.com to load the login form and set cookies
      const getHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
        'Cache-Control': 'max-age=0',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://kcls.libapps.com/',
        'sec-ch-ua': '"Microsoft Edge";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
      };
      console.log('Step 1: GET', this.AUTH_FORM_URL);
      const getResp = await client.get(this.AUTH_FORM_URL, {
        headers: getHeaders,
        maxRedirects: 5,
        validateStatus: (status: number) => status >= 200 && status < 400,
      });
      console.log('GET form page status:', getResp.status);
      console.log('GET response headers:', JSON.stringify(getResp.headers, null, 2));

      // Log cookies after GET request
      const cookiesAfterGet = await jar.getCookies(this.AUTH_FORM_URL);
      console.log('Cookies after GET:', cookiesAfterGet.map(c => `${c.key}=${c.value}`).join('; '));
      
      // Also check cookies for all domains
      const allCookies = jar.store.getAllCookies ? await new Promise<any[]>((resolve) => {
        jar.store.getAllCookies((err, cookies) => resolve(cookies || []));
      }) : [];
      console.log('All cookies in jar:', allCookies.map((c: any) => `${c.domain}:${c.key}=${c.value}`).join('; '));

      // Step 2: POST credentials
      // Manually construct form data to avoid double-encoding the login_url
      // The login_url needs to be URL-encoded once, but URLSearchParams would encode it twice
      const postBody = `auth_id=${this.AUTH_ID}&login_url=${encodeURIComponent(this.LOGIN_CALLBACK_URL)}&username=${credentials.libraryCard}&password=${credentials.pin}`;
      
      console.log('Step 2: POST to libauth.com/form_login with:');
      console.log('Form data (URL-encoded):', postBody);
      console.log('Form data length:', postBody.length);
      const postHeaders: Record<string, string> = {
        ...getHeaders,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postBody.length.toString(),
        'Origin': 'https://kcls.libapps.com',
        'Referer': 'https://kcls.libapps.com/',
        'priority': 'u=0, i',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-user': '?1',
      };
      console.log('Request headers:', postHeaders);
      
      // Log cookies being sent with POST
      const cookiesForPost = await jar.getCookies(this.AUTH_POST_URL);
      console.log('Cookies being sent with POST:', cookiesForPost.map(c => `${c.key}=${c.value}`).join('; '));
      
      const authResponse = await client.post(this.AUTH_POST_URL, postBody, {
        headers: postHeaders,
        maxRedirects: 0, // DON'T follow redirects - we need to extract the token from Location header!
        validateStatus: (status: number) => status >= 200 && status < 400, // Accept 2xx and 3xx
      });

      // Log detailed response from real auth server
      console.log('libauth.com response:');
      console.log('Status:', authResponse.status);
      console.log('Headers:', JSON.stringify(authResponse.headers, null, 2));

      // Check for 303 redirect with token
      if (authResponse.status === 303 && authResponse.headers.location) {
        const redirectUrl = authResponse.headers.location as string;
        console.log('Redirect URL:', redirectUrl);
        
        // Extract token from redirect URL
        const urlObj = new URL(redirectUrl);
        const token = urlObj.searchParams.get('token');
        
        if (token) {
          console.log('✅ Authentication successful! Token extracted:', token.substring(0, 20) + '...');
          
          // Create session
          const sessionId = this.generateSessionId();
          const expiresAt = Date.now() + this.SESSION_DURATION;

          const session: AuthSession = {
            sessionId,
            cookieJar: jar,
            expiresAt,
            libraryCard: credentials.libraryCard,
          };

          activeSessions.set(sessionId, session);

          console.log(`Authentication successful for ${credentials.libraryCard}, session: ${sessionId}`);

          return {
            success: true,
            sessionId,
            expiresAt,
            libraryCard: credentials.libraryCard,
            token, // Return the token to the client
          };
        } else {
          console.error('❌ Redirect received but no token found in URL');
          return {
            success: false,
            sessionId: '',
            expiresAt: 0,
            libraryCard: credentials.libraryCard,
            error: 'Authentication redirect missing token',
          };
        }
      }

      // If we get here, auth failed
      if (typeof authResponse.data === 'string') {
        console.log('Body (truncated):', authResponse.data.slice(0, 500));
      } else {
        console.log('Body:', authResponse.data);
      }

      // Log cookies received (for debugging)
      const cookies = await jar.getCookies('https://rooms.kcls.org');
      console.log('Cookies received for rooms.kcls.org:', cookies.map(c => c.cookieString()).join('; '));

      console.error('❌ Authentication failed: Unexpected response status', authResponse.status);
      return {
        success: false,
        sessionId: '',
        expiresAt: 0,
        libraryCard: credentials.libraryCard,
        error: 'Invalid library card or PIN',
      };
    } catch (error: any) {
      console.error('Authentication error:', error && error.message ? error.message : error);
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('Error response data:', typeof error.response.data === 'string' 
          ? error.response.data.slice(0, 500) 
          : error.response.data);
      }
      return {
        success: false,
        sessionId: '',
        expiresAt: 0,
        libraryCard: credentials.libraryCard,
        error: error && error.message ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): AuthSession | null {
    const session = activeSessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session expired
    if (Date.now() > session.expiresAt) {
      activeSessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Logout and destroy session
   */
  logout(sessionId: string): boolean {
    return activeSessions.delete(sessionId);
  }

  /**
   * Calculate CRC checksum for booking
   * Based on observed pattern: MD5 hash of concatenated values
   */
  calculateCRC(museum: string, pass: string, date: string): string {
    // TODO: Reverse engineer exact CRC calculation
    // For now, create MD5 hash of concatenated values
    const input = `${museum}${pass}${date}`;
    return crypto.createHash('md5').update(input).digest('hex');
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of activeSessions.entries()) {
      if (now > session.expiresAt) {
        activeSessions.delete(sessionId);
      }
    }
  }
}

export const authService = new AuthService();

// Cleanup expired sessions every 15 minutes
setInterval(() => {
  authService.cleanupExpiredSessions();
}, 15 * 60 * 1000);
