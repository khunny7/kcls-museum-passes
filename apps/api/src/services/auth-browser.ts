import puppeteer from 'puppeteer';

interface LoginCredentials {
  libraryCard: string;
  pin: string;
  bookingUrl?: string; // Optional: specific booking page to authenticate for
}

interface AuthResult {
  success: boolean;
  sessionId: string;
  expiresAt: number;
  libraryCard: string;
  cookies?: any[];
  browser?: any;
  context?: any;
  page?: any; // The page used for authentication, can be reused for booking
  error?: string;
}

/**
 * Browser-based authentication service using Puppeteer
 * This uses a real browser to bypass bot detection
 */
export class BrowserAuthService {
  private browser: any | null = null;
  // DON'T go directly to auth URL - must come from booking page for proper referer!
  private readonly BOOKING_PAGE = 'https://rooms.kcls.org/passes/33c1f0af9b02/book?date=2025-11-04&pass=bd7ebca17e8a&digital=1&physical=0&location=0';
  private readonly AUTH_URL = 'https://kcls.libapps.com/libapps/libauth?auth_id=1963';

  async initialize(): Promise<void> {
    console.log('[BrowserAuth.initialize] Method called');
    if (!this.browser) {
      console.log('[BrowserAuth.initialize] No existing browser, launching new one...');
      console.log('[BrowserAuth.initialize] Calling puppeteer.launch()...');
      const start = Date.now();
      try {
        this.browser = await Promise.race([
          puppeteer.launch({
            headless: true, // Run in headless mode (no visible browser window)
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-blink-features=AutomationControlled', // Hide automation
              '--disable-dev-shm-usage', // Overcome limited resource problems
              '--disable-gpu', // Not needed in headless
            ],
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Browser launch timeout after 30s')), 30000))
        ]);
        const elapsed = Date.now() - start;
        console.log(`[BrowserAuth.initialize] Browser launched successfully in ${elapsed}ms`);
      } catch (error: any) {
        console.error('[BrowserAuth.initialize] Failed to launch browser:', error.message);
        throw new Error(`Failed to launch browser: ${error.message}`);
      }
    } else {
      console.log('[BrowserAuth.initialize] Browser already exists, reusing');
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    console.log('[BrowserAuth.login] === BROWSER AUTH START ===');
    console.log('[BrowserAuth.login] Credentials:', { libraryCard: credentials.libraryCard, pin: '****', hasBookingUrl: !!credentials.bookingUrl });
    console.log('[BrowserAuth.login] About to enter try block...');
    
    // Use provided booking URL or fallback to default
    const bookingPageUrl = credentials.bookingUrl || this.BOOKING_PAGE;
    console.log('[BrowserAuth.login] Using booking page:', bookingPageUrl);
    
    try {
      console.log('[BrowserAuth.login] Inside try block');
      console.log('[BrowserAuth.login] Calling this.initialize()...');
      await this.initialize();
      console.log('[BrowserAuth.login] this.initialize() completed');
      
      if (!this.browser) {
        throw new Error('Browser not initialized');
      }

      console.log('[BrowserAuth.login] Calling browser.newPage()...');
      const page = await this.browser.newPage();
      console.log('[BrowserAuth.login] New page created');
      
      // Hide webdriver property to avoid bot detection
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });
      console.log('[BrowserAuth.login] Webdriver property masked');
      
      // Set a realistic viewport
      console.log('[BrowserAuth.login] Setting viewport...');
      await page.setViewport({ width: 1280, height: 720 });
      console.log('[BrowserAuth.login] Viewport set: 1280x720');

      // CRITICAL: Start from booking page, not auth URL directly!
      // Server checks referer chain - must come from rooms.kcls.org booking flow
      console.log('[BrowserAuth.login] Navigating to booking page first:', bookingPageUrl);
      await page.goto(bookingPageUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      console.log('[BrowserAuth.login] Booking page loaded - should auto-redirect to login');
      
      // Wait a moment for any redirects (reduced for speed)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const currentUrl = page.url();
      console.log('[BrowserAuth.login] Current URL after booking page:', currentUrl);
      
      // If not redirected to auth page, click the login button/link
      if (!currentUrl.includes('libauth')) {
        console.log('[BrowserAuth.login] Not redirected to auth, page might require interaction');
        // The booking page should show a login requirement
      }

      // Intercept requests to add missing browser headers to form POST
      await page.setRequestInterception(true);
      page.on('request', (request: any) => {
        if (request.url().includes('form_login') && request.method() === 'POST') {
          console.log('>>> INTERCEPTING FORM_LOGIN POST <<<');
          console.log('URL:', request.url());
          console.log('Method:', request.method());
          
          const headers = request.headers();
          console.log('ORIGINAL Headers:', JSON.stringify(headers, null, 2));
          
          // Add the EXACT headers from successful HAR that Puppeteer is missing
          const enhancedHeaders = {
            ...headers,
            'accept-encoding': 'gzip, deflate, br, zstd',
            'cache-control': 'max-age=0',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'cross-site',
            'sec-fetch-user': '?1',
            'priority': 'u=0, i'
          };
          
          console.log('ENHANCED Headers:', JSON.stringify(enhancedHeaders, null, 2));
          console.log('POST data:', request.postData());
          console.log('POST data length:', request.postData()?.length);
          
          // Continue with enhanced headers
          request.continue({ headers: enhancedHeaders });
        } else {
          request.continue();
        }
      });

      // Check cookies after page load
      const cookiesAfterLoad = await page.cookies();
      console.log('Cookies after loading page:', cookiesAfterLoad);
      console.log('Number of cookies:', cookiesAfterLoad.length);

      // Wait for the form to be fully loaded
      await page.waitForSelector('#s-libapps-libauth-form', { timeout: 10000 });
      console.log('Form found on page');

      // Check the form action and hidden fields
      const formInfo = await page.evaluate(() => {
        const form = document.getElementById('s-libapps-libauth-form') as HTMLFormElement;
        const authIdInput = document.querySelector('input[name="auth_id"]') as HTMLInputElement;
        const loginUrlInput = document.querySelector('input[name="login_url"]') as HTMLInputElement;
        
        return {
          action: form?.action,
          authId: authIdInput?.value,
          loginUrl: loginUrlInput?.value
        };
      });
      console.log('Form details:', formInfo);

      console.log('Filling in credentials...');
      console.log('Typing username...');
      await page.type('#username', credentials.libraryCard);
      console.log('Username entered');
      
      console.log('Typing password...');
      await page.type('#password', credentials.pin);
      console.log('Password entered');

      console.log('Submitting form...');
      
      // Check cookies before submitting
      const cookiesBeforeSubmit = await page.cookies();
      console.log('Cookies before form submit:', cookiesBeforeSubmit);
      console.log('Number of cookies before submit:', cookiesBeforeSubmit.length);
      
      // Submit the form and wait for navigation
      // Headers will be modified by the request interceptor above
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
        page.click('#s-libapps-login-button'),
      ]);
      console.log('Form submitted, navigation complete');

      // Get the final URL after redirect
      const finalUrl = page.url();
      console.log('Final URL:', finalUrl);

      // Check if login was successful by looking at the URL
      if (finalUrl.includes('rooms.kcls.org')) {
        console.log('Login successful! Redirected to rooms.kcls.org');
        
        // Extract token from URL if present
        const urlParams = new URL(finalUrl).searchParams;
        const token = urlParams.get('token');
        console.log('Token from URL:', token ? token.substring(0, 20) + '...' : 'none');

        // Get ALL cookies including HttpOnly using CDP
        const client = await page.target().createCDPSession();
        const allCookies = (await client.send('Network.getAllCookies' as any) as any).cookies;
        console.log('Cookies obtained (via CDP):', allCookies.length);
        console.log('Cookie domains:', [...new Set(allCookies.map((c: any) => c.domain))]);

        // DON'T close the page or browser - keep them alive for booking!
        // await page.close();
        console.log('Keeping browser and page open for future bookings');

        // Generate session ID
        const sessionId = Math.random().toString(36).substring(7);
        const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hours

        console.log('Session created:', sessionId);
        console.log('Expires at:', new Date(expiresAt).toISOString());
        console.log('=== BROWSER AUTH SUCCESS ===');

        return {
          success: true,
          sessionId,
          expiresAt,
          libraryCard: credentials.libraryCard,
          cookies: allCookies,
          browser: this.browser,
          context: page.browserContext(),
          page: page, // Return the page so it can be reused for booking
        };
      } else {
        console.log('Login failed - unexpected URL:', finalUrl);
        
        // Get the page HTML to see what happened
        const pageContent = await page.content();
        console.log('Page HTML (first 1000 chars):', pageContent.substring(0, 1000));
        
        // Login failed - check for error message
        let errorMessage = 'Login failed';
        try {
          // Try multiple selectors for error messages
          const errorSelectors = [
            '.alert-danger',
            '.error',
            '#form-msg-username',
            '#form-msg-password',
            '.s-lib-form-msg'
          ];
          
          for (const selector of errorSelectors) {
            try {
              const element = await page.$(selector);
              if (element) {
                const text = await page.evaluate((el: any) => el.textContent, element);
                if (text && text.trim()) {
                  errorMessage = text.trim();
                  console.log(`Error message from ${selector}:`, errorMessage);
                  break;
                }
              }
            } catch (e) {
              // Continue to next selector
            }
          }
          
          if (errorMessage === 'Login failed') {
            console.log('No specific error message found, checking for any visible text');
          }
        } catch (e) {
          console.log('Error while looking for error message:', e);
        }

        await page.close();
        console.log('=== BROWSER AUTH FAILED ===');

        return {
          success: false,
          sessionId: '',
          expiresAt: 0,
          libraryCard: credentials.libraryCard,
          error: errorMessage,
        };
      }
    } catch (error: any) {
      console.error('=== BROWSER AUTH ERROR ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      return {
        success: false,
        sessionId: '',
        expiresAt: 0,
        libraryCard: credentials.libraryCard,
        error: error.message || 'Authentication failed',
      };
    }
  }
}

// Session storage for browser auth cookies
export interface BrowserAuthSession {
  sessionId: string;
  cookies: any[];
  expiresAt: number;
  libraryCard: string;
  browser: any; // Keep the browser instance alive
  context: any; // Browser context with cookies
  page?: any; // The page used during login, can be reused for booking
}

export const browserSessions = new Map<string, BrowserAuthSession>();

export const browserAuthService = new BrowserAuthService();
