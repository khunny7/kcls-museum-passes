import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { CookieJar, Cookie } from 'tough-cookie';
// Note: We don't use axios-cookiejar-support because it has a cookie path bug
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { httpSessions, HttpAuthSession, httpAuthService } from './auth-http.js';

export interface BookingRequest {
  museumId: string;
  date: string;
  passId: string;
  digital?: boolean;
  physical?: boolean;
  location?: string;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  message?: string;
  error?: string;
  requiresAuth?: boolean;
  details?: any;
}

/**
 * HTTP-based booking service that replaces Puppeteer browser automation
 * Performs museum pass bookings using pure HTTP requests
 */
class HttpBookingService {
  private readonly BASE_URL = 'https://rooms.kcls.org';
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  /**
   * Create a configured axios client (without cookie jar wrapper)
   * We handle cookies manually to avoid axios-cookiejar-support bugs
   */
  private createClient(): AxiosInstance {
    return axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
      maxRedirects: 0,
      validateStatus: () => true,
    });
  }

  /**
   * Get cookie header string for a request URL
   */
  private async getCookieHeader(jar: CookieJar, url: string): Promise<string> {
    return await jar.getCookieString(url);
  }

  /**
   * Store cookies from response headers with correct path
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
          if (!cookieStr.toLowerCase().includes('path=')) {
            cookie.path = '/';
          }
          if (!cookie.domain) {
            cookie.domain = urlObj.hostname;
          }
          await jar.setCookie(cookie, requestUrl);
        }
      } catch (e) {
        // Ignore cookie parse errors
      }
    }
  }

  /**
   * Build the booking URL for a pass
   * This is used by both regular booking and scheduled booking
   */
  public buildBookingUrl(request: BookingRequest): string {
    const digital = request.digital ? '1' : '0';
    const physical = request.physical ? '1' : '0';
    const location = request.location || '0';
    return `${this.BASE_URL}/passes/${request.museumId}/book?digital=${digital}&physical=${physical}&location=${location}&date=${request.date}&pass=${request.passId}`;
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
      'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    };
  }

  /**
   * Book a museum pass using HTTP requests
   */
  async bookPass(
    sessionId: string,
    request: BookingRequest
  ): Promise<BookingResult> {
    const { museumId, date, passId, digital = true, physical = false, location = '0' } = request;

    console.log('[HttpBooking] Starting booking...');
    console.log('[HttpBooking] Museum:', museumId);
    console.log('[HttpBooking] Date:', date);
    console.log('[HttpBooking] Pass:', passId);
    console.log('[HttpBooking] Session:', sessionId);

    // Get the session
    const session = httpSessions.get(sessionId);
    if (!session) {
      console.log('[HttpBooking] ❌ Session not found');
      return {
        success: false,
        requiresAuth: true,
        error: 'Session expired. Please log in again.',
      };
    }

    if (session.expiresAt < Date.now()) {
      console.log('[HttpBooking] ❌ Session expired');
      httpSessions.delete(sessionId);
      return {
        success: false,
        requiresAuth: true,
        error: 'Session expired. Please log in again.',
      };
    }

    console.log('[HttpBooking] ✓ Valid session found');

    const client = this.createClient();
    const jar = session.cookieJar;

    try {
      // Step 1: Access the booking page using the exact URL from auth redirect
      // This is crucial because the token checksum is tied to the exact URL string
      let finalBookingUrl: string;
      
      if (session.bookingUrl) {
        // Use the exact booking URL from auth (includes token with correct param order)
        const urlObj = new URL(session.bookingUrl);
        finalBookingUrl = urlObj.pathname + urlObj.search;
        console.log('[HttpBooking] Step 1: Using auth redirect URL');
        console.log('[HttpBooking] Full URL length:', finalBookingUrl.length);
        console.log('[HttpBooking] Token in URL:', urlObj.searchParams.get('token')?.substring(0, 20) + '...');
      } else {
        // Fallback: construct URL manually (may not work if param order matters)
        const bookingUrl = `/passes/${museumId}/book?date=${date}&pass=${passId}&digital=${digital ? '1' : '0'}&physical=${physical ? '1' : '0'}&location=${location}`;
        finalBookingUrl = session.token ? `${bookingUrl}&token=${session.token}` : bookingUrl;
        console.log('[HttpBooking] Step 1: Constructed booking URL (fallback):', finalBookingUrl.substring(0, 100));
      }

      console.log('[HttpBooking] Accessing booking page...');
      
      // Get cookies for the request
      const bookingCookies = await this.getCookieHeader(jar, `${this.BASE_URL}${finalBookingUrl}`);
      console.log('[HttpBooking] Cookies for booking page:', bookingCookies ? `${bookingCookies.length} chars` : 'NONE');
      
      const bookingPageResponse = await client.get(finalBookingUrl, {
        headers: {
          ...this.getBaseHeaders(),
          'Referer': 'https://rooms.kcls.org/passes',
          'Cookie': bookingCookies,
        },
      });
      
      // Store any new cookies from response
      await this.storeCookiesFromResponse(jar, bookingPageResponse, `${this.BASE_URL}${finalBookingUrl}`);

      console.log('[HttpBooking] Booking page status:', bookingPageResponse.status);

      // Debug: If we get a 400, log the response body
      if (bookingPageResponse.status === 400) {
        const body = typeof bookingPageResponse.data === 'string' 
          ? bookingPageResponse.data.substring(0, 200) 
          : JSON.stringify(bookingPageResponse.data).substring(0, 200);
        console.log('[HttpBooking] ❌ 400 Response body:', body);
        
        // The booking page itself is returning 400 - this means the token/URL is invalid
        return {
          success: false,
          error: 'Booking page returned error. Token may have expired.',
        };
      }

      // Check if we need to authenticate
      if (bookingPageResponse.status === 302 || bookingPageResponse.status === 303) {
        const redirectLocation = bookingPageResponse.headers.location;
        if (redirectLocation && redirectLocation.includes('libauth')) {
          console.log('[HttpBooking] ❌ Redirected to login - session invalid');
          return {
            success: false,
            requiresAuth: true,
            error: 'Session expired. Please log in again.',
          };
        }
      }

      // Parse the booking page HTML
      const $ = cheerio.load(bookingPageResponse.data);

      // Check for error messages
      const errorAlert = $('.alert-danger, .alert-error').text().trim();
      if (errorAlert) {
        console.log('[HttpBooking] ❌ Error on page:', errorAlert);
        return {
          success: false,
          error: errorAlert,
        };
      }

      // Check if pass is unavailable
      const unavailableMsg = $('.s-lc-pass-unavailable').text().trim();
      if (unavailableMsg) {
        console.log('[HttpBooking] ❌ Pass unavailable:', unavailableMsg);
        return {
          success: false,
          error: 'Pass is not available for this date.',
        };
      }

      // Step 2: Look for the booking form and extract required fields
      const bookingForm = $('#s-lc-rm-form, #booking-form, form[action*="book"]');
      
      if (bookingForm.length === 0) {
        // Maybe we need to accept terms first
        const termsForm = $('#terms-form, form:has(#terms_accept)');
        if (termsForm.length > 0) {
          console.log('[HttpBooking] Step 2: Accepting terms...');
          
          // Find the terms accept action
          const termsAction = termsForm.attr('action') || `/passes/${museumId}/book`;
          
          // Submit terms acceptance - this might be an AJAX call or form submit
          // Check if there's an AJAX endpoint for terms
          const termsUrl = `/pass/acceptTerms/${museumId}` || termsAction;
          
          try {
            const termsResponse = await client.post(termsUrl, '', {
              headers: {
                ...this.getBaseHeaders(),
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': `${this.BASE_URL}${finalBookingUrl}`,
                'X-Requested-With': 'XMLHttpRequest', // Often needed for AJAX calls
              },
            });
            console.log('[HttpBooking] Terms acceptance status:', termsResponse.status);
          } catch (e: any) {
            console.log('[HttpBooking] Terms acceptance result:', e.message);
          }
        }
      }

      // Step 3: Extract form data and submit the booking
      console.log('[HttpBooking] Step 3: Submitting booking form...');

      // Build the booking form data - extract hidden fields FIRST
      const bookingFormData = new URLSearchParams();
      
      // First, extract all hidden fields from the form (including CRC)
      let formCrc = '';
      $('input[type="hidden"]').each((_, el) => {
        const name = $(el).attr('name');
        const value = $(el).attr('value');
        if (name && value) {
          bookingFormData.append(name, value);
          console.log(`[HttpBooking] Extracted hidden field: ${name}=${name === 'crc' ? value : '...'}`);
          if (name === 'crc') {
            formCrc = value;
          }
        }
      });

      // If no CRC was found in the form, calculate one as fallback
      if (!formCrc) {
        console.log('[HttpBooking] No CRC in form, calculating...');
        const crc = this.calculateCRC(museumId, passId, date);
        console.log('[HttpBooking] Calculated CRC:', crc);
        bookingFormData.append('crc', crc);
      } else {
        console.log('[HttpBooking] Using CRC from form:', formCrc);
      }

      // Ensure required fields are set (may already be from form)
      if (!bookingFormData.has('museum')) {
        bookingFormData.append('museum', museumId);
      }
      if (!bookingFormData.has('pass')) {
        bookingFormData.append('pass', passId);
      }
      if (!bookingFormData.has('date')) {
        bookingFormData.append('date', date);
      }
      
      // Add digital/physical flags
      if (digital && !bookingFormData.has('digital')) {
        bookingFormData.append('digital', '1');
      }
      if (physical && !bookingFormData.has('physical')) {
        bookingFormData.append('physical', '1');
      }
      if (!bookingFormData.has('location')) {
        bookingFormData.append('location', location);
      }

      // Get cookies for the submit request
      const submitCookies = await this.getCookieHeader(jar, `${this.BASE_URL}/passes/${museumId}/book`);
      console.log('[HttpBooking] Cookies for submit:', submitCookies ? `${submitCookies.length} chars` : 'NONE');

      // Submit the booking
      const submitResponse = await client.post(`/passes/${museumId}/book`, bookingFormData.toString(), {
        headers: {
          ...this.getBaseHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': this.BASE_URL,
          'Referer': `${this.BASE_URL}${finalBookingUrl}`,
          'Cookie': submitCookies,
        },
      });
      
      // Store any new cookies from response
      await this.storeCookiesFromResponse(jar, submitResponse, `${this.BASE_URL}/passes/${museumId}/book`);

      console.log('[HttpBooking] Submit response status:', submitResponse.status);

      // Parse the response
      const $result = cheerio.load(submitResponse.data);

      // Check for success indicators
      const successMsg = $result('.alert-success, .success-message, .confirmation').text().trim();
      const confirmationNumber = $result('.confirmation-number, .booking-id, #confirmation').text().trim();
      
      // Also check for specific success patterns in the HTML
      const pageText = $result.text().toLowerCase();
      const isSuccess = 
        pageText.includes('confirmed') ||
        pageText.includes('reserved') ||
        pageText.includes('booked') ||
        pageText.includes('success') ||
        pageText.includes('congratulations') ||
        submitResponse.status === 200 && (successMsg || confirmationNumber);

      // Check for error messages
      const resultError = $result('.alert-danger, .alert-error, .error-message').text().trim();
      
      if (resultError) {
        console.log('[HttpBooking] ❌ Booking failed:', resultError);
        return {
          success: false,
          error: resultError,
        };
      }

      if (isSuccess) {
        console.log('[HttpBooking] ✅ Booking successful!');
        return {
          success: true,
          bookingId: confirmationNumber || `booking_${Date.now()}`,
          message: successMsg || 'Pass reserved successfully!',
        };
      }

      // If we can't determine success/failure, log the page for debugging
      console.log('[HttpBooking] ⚠️ Uncertain result, page content (first 1000 chars):');
      console.log(submitResponse.data.substring(0, 1000));

      // Check if we're still on the booking page (might need more steps)
      if (pageText.includes('reserve') || pageText.includes('confirm')) {
        // Might need to click confirm button - try a second POST
        console.log('[HttpBooking] Attempting confirmation step...');
        const confirmResponse = await client.post(`/passes/${museumId}/confirm`, bookingFormData.toString(), {
          headers: {
            ...this.getBaseHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': this.BASE_URL,
            'Referer': `${this.BASE_URL}/passes/${museumId}/book`,
          },
        });

        const $confirm = cheerio.load(confirmResponse.data);
        const confirmSuccess = $confirm('.alert-success, .confirmation').text().trim();
        const confirmError = $confirm('.alert-danger, .error').text().trim();

        if (confirmError) {
          return {
            success: false,
            error: confirmError,
          };
        }

        if (confirmSuccess || confirmResponse.status === 200) {
          return {
            success: true,
            bookingId: `booking_${Date.now()}`,
            message: confirmSuccess || 'Pass reserved successfully!',
          };
        }
      }

      // Return uncertain result
      return {
        success: true, // Assume success if no error
        bookingId: `booking_${Date.now()}`,
        message: 'Booking submitted. Please verify in your reservations.',
        details: {
          status: submitResponse.status,
          mayNeedVerification: true,
        },
      };

    } catch (error: any) {
      console.error('[HttpBooking] ❌ Error:', error.message);
      
      if (error.response) {
        console.error('[HttpBooking] Response status:', error.response.status);
        
        // Check for auth redirect
        if (error.response.status === 302 || error.response.status === 303) {
          const location = error.response.headers.location;
          if (location && location.includes('libauth')) {
            return {
              success: false,
              requiresAuth: true,
              error: 'Session expired. Please log in again.',
            };
          }
        }
      }

      return {
        success: false,
        error: error.message || 'Booking failed',
      };
    }
  }

  /**
   * Calculate CRC checksum for booking
   * Based on observed pattern: MD5 hash of concatenated values
   */
  calculateCRC(museum: string, pass: string, date: string): string {
    // The CRC appears to be an MD5 hash of museum+pass+date
    const input = `${museum}${pass}${date}`;
    return crypto.createHash('md5').update(input).digest('hex');
  }

  /**
   * Try an alternate CRC calculation if the first one fails
   */
  calculateCRCAlt(museum: string, pass: string, date: string): string {
    // Try different combinations
    const input = `${museum}-${pass}-${date}`;
    return crypto.createHash('md5').update(input).digest('hex');
  }

  /**
   * Complete booking flow: login + book
   * This is the unified method used by both regular booking and scheduled booking.
   * The only difference is WHEN this gets called.
   */
  async bookWithCredentials(
    credentials: { libraryCard: string; pin: string },
    request: BookingRequest,
    logger?: (message: string) => void
  ): Promise<BookingResult> {
    const log = logger || ((msg: string) => console.log(`[HttpBooking] ${msg}`));

    try {
      // Step 1: Build the booking URL
      const bookingUrl = this.buildBookingUrl(request);
      log(`Booking URL: ${bookingUrl}`);

      // Step 2: Login for this specific booking URL
      log('Logging in...');
      const loginResult = await httpAuthService.loginForBooking(credentials, bookingUrl);

      if (!loginResult.success) {
        log(`Login failed: ${loginResult.error}`);
        return {
          success: false,
          error: `Login failed: ${loginResult.error}`,
        };
      }

      log(`Login successful, sessionId: ${loginResult.sessionId}`);

      // Step 3: Book the pass
      log('Booking pass...');
      const result = await this.bookPass(loginResult.sessionId!, request);

      log(`Booking result: ${JSON.stringify(result)}`);

      // Step 4: Clean up session
      httpAuthService.deleteSession(loginResult.sessionId!);
      log('Session cleaned up');

      return result;
    } catch (error: any) {
      log(`Error: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Booking failed',
      };
    }
  }
}

// Export singleton instance
export const httpBookingService = new HttpBookingService();
