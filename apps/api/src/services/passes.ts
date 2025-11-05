import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AxiosInstance } from 'axios';
import museumsDataJson from '../data/museums.json';

export interface MuseumMetadata {
  id: string;
  name: string;
  shortName: string;
  passesPerDay: number | string;
  peoplePerPass: number | string;
  ageRequirement: string;
  price: string;
  website: string;
}

type MuseumsDataFile = {
  museums: MuseumMetadata[];
};

const museumsData = museumsDataJson as MuseumsDataFile;

export interface Pass {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  available: boolean;
  metadata?: MuseumMetadata;
}

export interface PassDetails extends Pass {
  fullDescription: string;
  location: string;
  terms?: string;
}

export interface AvailabilitySlot {
  date: string;
  passId: string;
  available: boolean;
  digital: boolean;
  physical: boolean;
  state?: 'available' | 'booked' | 'closed' | 'not-yet-available';  // Distinguish between states
}

export interface BookingRequest {
  museumId: string;
  date: string;
  passId: string;
  digital: boolean;
  physical: boolean;
  location: string;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  message?: string;
  error?: string;
  requiresAuth?: boolean;
  authUrl?: string;
}

export class PassesService {
  private readonly client: AxiosInstance;
  private readonly baseUrl = 'https://rooms.kcls.org';
  private readonly museums: Map<string, MuseumMetadata>;

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // Load museums into a Map for quick lookup
    this.museums = new Map(
      museumsData.museums.map((m: MuseumMetadata) => [m.id, m])
    );
  }

  getMuseumMetadata(passId: string): MuseumMetadata | undefined {
    return this.museums.get(passId);
  }

  async getAllPasses(): Promise<Pass[]> {
    try {
      console.log('Fetching real passes from KCLS website...');
      const response = await this.client.get('/passes');
      const $ = cheerio.load(response.data);
      const passes: Pass[] = [];

      // Parse the actual passes from the KCLS HTML
      $('.s-lc-eventcard.s-lc-passcard').each((_, element) => {
        const $el = $(element);
        
        // Extract the pass link and ID
        const link = $el.find('a[href*="/passes/"]').first();
        const href = link.attr('href');
        
        if (href) {
          const id = href.split('/passes/')[1]?.split('?')[0] || '';
          
          // Extract pass details
          const name = $el.find('h2.s-lc-eventcard-title a').text().trim();
          const description = $el.find('.s-lc-eventcard-description').text().trim();
          const imageUrl = $el.find('.s-lc-eventcard-heading-image img').attr('src');
          
          if (id && name) {
            passes.push({
              id,
              name,
              description,
              imageUrl: imageUrl?.startsWith('http') ? imageUrl : `https://d2jv02qf7xgjwx.cloudfront.net${imageUrl}`,
              available: true, // We'll check actual availability via the API
              metadata: this.getMuseumMetadata(id)
            });
          }
        }
      });

      console.log(`Successfully scraped ${passes.length} passes from KCLS`);
      
      if (passes.length > 0) {
        return passes;
      } else {
        console.warn('No passes found in KCLS HTML, falling back to known passes');
        // Fallback to known passes if scraping fails
        return this.getFallbackPasses();
      }
      
    } catch (error: any) {
      console.error('Error scraping passes from KCLS:', error.message);
      console.log('Falling back to known passes');
      return this.getFallbackPasses();
    }
  }

  private getFallbackPasses(): Pass[] {
    // Fallback list of known KCLS passes if scraping fails
    return [
      {
        id: '6a9d5eb8d7f8',
        name: 'KidsQuest Children\'s Museum',
        description: 'Explore, play and learn at KidsQuest Children\'s Museum. KidsQuest is a hands-on, interactive museum for children and families designed to engage kids from birth to age eight. KidsQuest\'s exhibits and programs integrate science, technology, engineering, art and math for whole-body, whole-brain learning.',
        imageUrl: 'https://d2jv02qf7xgjwx.cloudfront.net/customers/3774/images/KidsQuest_Childrens_Museum.png',
        available: true
      },
      {
        id: 'dcb899890d0c',
        name: 'Museum of History & Industry',
        description: 'Discover Seattle\'s maritime and industrial heritage at MOHAI. Learn about the region\'s innovation, history, and culture through engaging exhibits and artifacts.',
        imageUrl: 'https://d2jv02qf7xgjwx.cloudfront.net/customers/3774/images/Museum_of_History_and_Industry.png',
        available: true
      },
      {
        id: '33c1f0af9b02',
        name: 'Museum of Pop Culture',
        description: 'Quick, what\'s your favorite album? Video game? Movie or show? Pop culture lies at the heart of our lives and community identities, and the Museum of Pop Culture celebrates all of it, taking you behind the scenes of your favorite fandoms through immersive exhibitions and stunning artifacts — from Nirvana to Horror to SciFi and everything in between.',
        imageUrl: 'https://d2jv02qf7xgjwx.cloudfront.net/customers/3774/images/new_Museum_of_Pop_Culture.png',
        available: true
      },
      {
        id: 'ba4a1c71f547',
        name: 'Museum of Flight',
        description: 'Relive the exciting history of aviation and aerospace at The Museum of Flight! With over 175 aircraft and spacecraft, thousands of artifacts and dozens of experiences, there\'s so much to see and do. Enjoy education programs that make learning fun for the whole family. Walk the aisles of Air Force One. Stand beneath the Blackbird spy plane. Marvel at the heroics of WWI and WWII aviators.',
        imageUrl: 'https://d2jv02qf7xgjwx.cloudfront.net/customers/3774/images/The_Museum_of_Flight2.png',
        available: true
      },
      {
        id: 'b03f547b9c80',
        name: 'Northwest African American Museum',
        description: 'The Northwest African American Museum\'s (NAAM) mission is to use Black heritage to cultivate understanding, healing, and hope. NAAM\'s vision is a Pacific Northwest region where the important histories, arts, and cultures of people of African descent are embraced as an essential part of our shared heritage and future, and equity is a reality for everyone.',
        imageUrl: 'https://d2jv02qf7xgjwx.cloudfront.net/customers/3774/images/NAAM_2020_Stacked_Logo_Icon___Text_Color.png',
        available: true
      },
      {
        id: '6bccded8c288',
        name: 'Northwest Railway Museum',
        description: 'The Northwest Railway Museum immerses visitors in the excitement of a working railroad while they learn the role railroads played in the development and settlement of Washington State and its surrounding areas. The Museum has a large and comprehensive collection, which makes it a must-visit for those interested in this region\'s history.',
        imageUrl: 'https://d2jv02qf7xgjwx.cloudfront.net/customers/3774/images/Northwest_Railway_Museum.png',
        available: true
      },
      {
        id: 'cd3534a4e786',
        name: 'Rhododendron Botanical Garden',
        description: 'RSBG is home to the largest collection of Rhododendron species in the world. Experience an enchanting botanical collection in a Pacific Northwest forest. As a living museum, RSBG is a 22-acre woodland garden. Filled with colorful, rare, and interesting plants from all over the world.',
        imageUrl: 'https://d2jv02qf7xgjwx.cloudfront.net/customers/3774/images/Rhododendron_Species_Botanical_Garden.png',
        available: true
      },
      {
        id: '8e456682901d',
        name: 'Seattle Aquarium',
        description: 'Discover the wonders of the marine environment at the Seattle Aquarium! Get to know the amazing animals found in our local waters while exploring Piers 59 and 60. Then visit the Ocean Pavilion for a virtual trip to the Indo-Pacific with tropical animals, plants and more. Proudly accredited by the Association of Zoos and Aquariums.',
        imageUrl: 'https://d2jv02qf7xgjwx.cloudfront.net/customers/3774/images/Seattle_Aquarium_Logo-Mediterranean-SM.jpg',
        available: true
      },
      {
        id: '14621cebb10b',
        name: 'Seattle Art Museum',
        description: 'Seattle Art Museum is the leading visual art institution in the Pacific Northwest. SAM builds bridges between cultures and centuries with collections, exhibitions, and programs from around the world. SAM\'s three unique locations celebrate the region\'s position as a crossroads where East meets West, urban meets natural, and local meets global.',
        imageUrl: 'https://d2jv02qf7xgjwx.cloudfront.net/customers/3774/images/Seattle_Art_Museum.png',
        available: true
      },
      {
        id: '0cc2150f16b9',
        name: 'Washington State History Museum',
        description: 'The Washington State History Museum is where fascination and FUN come together! Explore Washington\'s people, places, and impacts on the world through the museum\'s interactive exhibits, dynamic storytelling, and amazing artifacts. There is always something new to see, do, and learn.',
        imageUrl: 'https://d2jv02qf7xgjwx.cloudfront.net/customers/3774/images/Washington_State_History_Museum.png',
        available: true
      },
      {
        id: '9ec25160a8a0',
        name: 'Wing Luke Museum',
        description: 'The Wing Luke Museum is an art and history museum in Seattle, Washington, United States, which focuses on the culture, art and history of Asian Americans, Native Hawaiians, and Pacific Islanders. It is located in Seattle\'s Chinatown-International District. Established in 1967, the museum is a Smithsonian Institution affiliate.',
        imageUrl: 'https://d2jv02qf7xgjwx.cloudfront.net/customers/3774/images/Black_over_Transparent_RGB_centered.png',
        available: true
      },
      {
        id: '15d03dcb51d3',
        name: 'Woodland Park Zoo',
        description: 'Founded in 1899, Woodland Park Zoo has sparked delight, discovery and unforgettable memories for generations of Northwest families. People who experience the wonders of the natural world are inspired to protect it. Every year we lead more than 1 million people on a journey that inspires a lifelong love of animals.',
        imageUrl: 'https://d2jv02qf7xgjwx.cloudfront.net/customers/3774/images/Woodland_Park_Zoo.png',
        available: true
      }
    ];
  }

  /* Original scraping code - disabled for now
    try {
      const response = await this.client.get('/passes');
      const $ = cheerio.load(response.data);
      const passes: Pass[] = [];

      // Parse the passes from the HTML
      $('.passes-listing__institution').each((_, element) => {
        const $el = $(element);
        const link = $el.find('a').first();
        const href = link.attr('href');
        
        if (href) {
          const id = href.split('/').pop() || '';
          const name = $el.find('.passes-listing__name').text().trim();
          const description = $el.find('.passes-listing__description').text().trim();
          const imageUrl = $el.find('img').attr('src');
          
          passes.push({
            id,
            name,
            description,
            imageUrl,
            available: true
          });
        }
      });

      return passes.length > 0 ? passes : mockData;
    } catch (error) {
      console.error('Error fetching passes:', error);
      return mockData;
    }
    */

  async getPassDetails(id: string): Promise<PassDetails | null> {
    try {
      console.log(`Fetching pass details for ${id} from KCLS...`);
      const response = await this.client.get(`/passes/${id}`);
      const $ = cheerio.load(response.data);
      
      // Extract pass details from the page
      const name = $('h1.s-lc-public-header-title, .s-lc-eq-location-name').first().text().trim();
      const description = $('.s-lc-location-description p').first().text().trim() || 
                         $('.s-lc-eq-location-description').text().trim();
      
      // Get full description (may include multiple paragraphs)
      let fullDescription = '';
      $('.s-lc-location-description').each((_, el) => {
        fullDescription += $(el).text().trim() + '\n\n';
      });
      
      const imageUrl = $('.s-lc-location-image img, .s-lc-eq-location-image img').first().attr('src');
      
      // Get metadata
      const metadata = this.getMuseumMetadata(id);
      
      return {
        id,
        name: name || metadata?.name || 'Unknown Museum',
        description: description || 'No description available',
        fullDescription: fullDescription.trim() || description,
        location: 'King County Library System',
        imageUrl: imageUrl?.startsWith('http') ? imageUrl : `https://d2jv02qf7xgjwx.cloudfront.net${imageUrl}`,
        available: true,
        metadata
      };
    } catch (error) {
      console.error(`Error fetching pass details for ${id}:`, error);
      return null;
    }
  }

  async getPassAvailability(
    museumId: string,
    date: string,
    digital: boolean = true,
    physical: boolean = false,
    location: string = '0'
  ): Promise<AvailabilitySlot[]> {
    try {
      // Call the real KCLS availability API - returns HTML calendar
      const url = `/pass/availability/institution`;
      const params = {
        museum: museumId,
        date,
        digital: digital ? '1' : '0',
        physical: physical ? '1' : '0',
        location
      };

      console.log(`Fetching real availability for museum ${museumId} on ${date}`);
      const response = await this.client.get(url, { params });
      
      // Parse the HTML response to extract availability information
      const $ = cheerio.load(response.data);
      const slots: AvailabilitySlot[] = [];
      
      // Parse each day in the calendar
      $('.day').each((_, dayElement) => {
        const $day = $(dayElement);
        
        // Extract the date from the class name (e.g., "day-2025-10-19")
        const dayClass = $day.attr('class') || '';
        const dateMatch = dayClass.match(/day-(\d{4}-\d{2}-\d{2})/);
        
        if (!dateMatch) return;
        
        const dayDate = dateMatch[1];
        
        // Check if there's an availability link (available pass)
        const availabilityLink = $day.find('a.s-lc-pass-availability');
        const availabilitySpan = $day.find('span.s-lc-pass-availability');
        
        if (availabilityLink.length > 0) {
          // Available pass - extract pass ID from href
          const href = availabilityLink.attr('href') || '';
          const passMatch = href.match(/pass=([a-f0-9]+)/);
          const passId = passMatch ? passMatch[1] : '';
          
          const isDigital = availabilityLink.hasClass('s-lc-pass-digital');
          const isPhysical = availabilityLink.hasClass('s-lc-pass-physical');
          
          slots.push({
            date: dayDate,
            passId,
            available: true,
            digital: isDigital,
            physical: isPhysical,
            state: 'available'
          });
        } else if (availabilitySpan.length > 0) {
          // Distinguish between different unavailable states
          const isClosed = availabilitySpan.hasClass('s-lc-pass-closed');
          const isUnavailable = availabilitySpan.hasClass('s-lc-pass-unavailable');
          const isNotYetAvailable = availabilitySpan.hasClass('s-lc-pass-not-yet-available');
          
          // Determine the state
          let state: 'booked' | 'closed' | 'not-yet-available' = 'booked';
          if (isClosed) {
            state = 'closed';
          } else if (isNotYetAvailable) {
            state = 'not-yet-available';
          }
          
          slots.push({
            date: dayDate,
            passId: '', // No pass ID for unavailable/closed/not-yet-available slots
            available: false,
            digital: state === 'closed' ? false : digital,
            physical: state === 'closed' ? false : physical,
            state
          });
        }
      });
      
      console.log(`Parsed ${slots.length} availability slots from KCLS calendar`);
      return slots;
      
    } catch (error: any) {
      console.error(`Error fetching real availability for ${museumId}:`, error.message);
      
      // For debugging: log the full error details
      if (error.response) {
        console.error('KCLS API error response:', error.response.status);
      }
      
      // Return empty array instead of mock data to show real system status
      return [];
    }
  }
  
  async getPassesByDate(
    date: string,
    digital: boolean = true,
    physical: boolean = false,
    location: string = '0'
  ): Promise<Pass[]> {
    try {
      // Call the KCLS API to get all available passes for a specific date
      const url = `/pass/availability/date`;
      const params = {
        date,
        digital: digital ? '1' : '0',
        physical: physical ? '1' : '0',
        location
      };

      console.log(`Fetching passes available on ${date} with params:`, params);
      const response = await this.client.get(url, { params });
      
      // Parse the HTML response to extract pass information
      const $ = cheerio.load(response.data);
      const passes: Pass[] = [];
      
      // Parse each museum card - look for the correct selector based on HAR file
      $('.s-lc-pass-date-museum').each((_, element) => {
        const $el = $(element);
        
        // Extract museum details from media structure
        const name = $el.find('h3.media-heading').text().trim();
        const description = $el.find('.media-body p').first().text().trim();
        const imageUrl = $el.find('.media-object').attr('src');
        
        // Extract pass link and ID from booking link
        const bookingLink = $el.find('a[href*="/book"]').first();
        const href = bookingLink.attr('href');
        
        if (href && name) {
          // Extract museum ID from href: /passes/{museumId}/book?pass={passId}...
          const museumIdMatch = href.match(/\/passes\/([a-f0-9]+)/);
          const museumId = museumIdMatch ? museumIdMatch[1] : '';
          
          if (museumId) {
            passes.push({
              id: museumId,
              name,
              description,
              imageUrl: imageUrl?.startsWith('http') ? imageUrl : undefined,
              available: true // If it's in this list, it's available for this date
            });
          }
        }
      });

      console.log(`Found ${passes.length} available passes for ${date}`);
      return passes;
      
    } catch (error: any) {
      console.error(`Error fetching passes for date ${date}:`, error.message);
      
      if (error.response) {
        console.error('KCLS API error response:', error.response.status);
      }
      
      return [];
    }
  }

  async bookPass(
    museumId: string,
    date: string,
    passId: string,
    sessionId: string,
    digital: boolean = true,
    physical: boolean = false,
    location: string = '0'
  ): Promise<BookingResult> {
    try {
      // Build the KCLS booking URL with all necessary parameters
      const bookingUrl = `${this.baseUrl}/passes/${museumId}/book?` + 
        `pass=${passId}&` +
        `date=${date}&` +
        `digital=${digital ? '1' : '0'}&` +
        `physical=${physical ? '1' : '0'}&` +
        `location=${location}`;
      
      console.log('Booking request:', {
        museumId,
        date,
        passId,
        sessionId,
        digital,
        physical,
        location,
        bookingUrl
      });

      // Import browser auth service to get session cookies
      const { browserSessions } = await import('./auth-browser.js');
      const session = browserSessions.get(sessionId);
      
      if (!session) {
        console.log('Session not found:', sessionId);
        return {
          success: false,
          requiresAuth: true,
          error: 'Session expired. Please log in again.'
        };
      }
      
      if (session.expiresAt < Date.now()) {
        console.log('Session expired:', sessionId);
        browserSessions.delete(sessionId);
        return {
          success: false,
          requiresAuth: true,
          error: 'Session expired. Please log in again.'
        };
      }
      
      console.log('Found valid session with', session.cookies.length, 'cookies');
      
      // Reuse the existing browser context from login instead of creating a new one
      if (!session.browser || !session.context) {
        console.log('Session has no browser context');
        return {
          success: false,
          requiresAuth: true,
          error: 'Session browser context lost. Please log in again.'
        };
      }
      
      console.log('Reusing existing browser from session');
      const browser = session.browser;
      
      // Reuse the existing page from login if available
      let page;
      if (session.page) {
        console.log('Reusing existing page from login session');
        page = session.page;
        
        // Poll for page to be ready (check every 100ms, max 1s)
        console.log('Waiting for page to be ready after login...');
        const startTime = Date.now();
        let ready = false;
        while (!ready && Date.now() - startTime < 1000) {
          try {
            // Check if page is ready by trying to get URL
            const url = page.url();
            if (url) ready = true;
          } catch {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        console.log(`Page ready after ${Date.now() - startTime}ms`);
        
        const currentUrl = page.url();
        console.log('Current page URL after login:', currentUrl);
      } else {
        console.log('No existing page found - this should not happen after fresh login');
        // Fallback: create a new page if somehow the page wasn't stored
        page = await session.context.newPage();
        console.log('Created new page in existing browser context');
        
        // Navigate to booking page - cookies should already be set
        console.log('Navigating to booking page:', bookingUrl);
        await page.goto(bookingUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      }
      
      const currentUrl = page.url();
      console.log('Current URL for booking:', currentUrl);
      
      // Check if we're at the authorization consent page or booking page with Agree button
      if (currentUrl.includes('libauth') || currentUrl.includes('/book')) {
        console.log('On booking page - looking for Agree button or booking form');
        
        try {
          // First, check if we need to click "Agree" button
          console.log('Searching for Agree button with selector: #terms_accept');
          const agreeButton = await page.$('#terms_accept');
          console.log('Agree button found:', !!agreeButton);
          
          if (agreeButton) {
            console.log('Found Agree button (#terms_accept), checking visibility...');
            
            // Check if visible and get button info
            const buttonInfo = await page.evaluate(() => {
              const btn = document.querySelector('#terms_accept') as HTMLElement;
              if (!btn) return null;
              
              const rect = btn.getBoundingClientRect();
              const style = window.getComputedStyle(btn);
              return {
                visible: rect.width > 0 && rect.height > 0,
                display: style.display,
                visibility: style.visibility,
                tagName: btn.tagName,
                type: btn.getAttribute('type'),
                id: btn.id,
                className: btn.className,
                text: btn.textContent?.trim()
              };
            });
            
            console.log('Agree button info:', buttonInfo);
            
            // Click using JavaScript click() method which is more reliable
            console.log('Clicking Agree button using JavaScript click()...');
            await page.evaluate(() => {
              const btn = document.querySelector('#terms_accept') as HTMLElement;
              if (btn) {
                btn.click();
              }
            });
            console.log('Clicked Agree button successfully');
            
            // Poll for booking form to appear (check every 100ms, max 3s)
            const formWaitStart = Date.now();
            let formVisible = false;
            while (!formVisible && Date.now() - formWaitStart < 3000) {
              try {
                const submitBtn = await page.$('#btn-form-submit');
                if (submitBtn) {
                  const visible = await page.evaluate((btn: any) => {
                    const rect = btn.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                  }, submitBtn);
                  if (visible) {
                    formVisible = true;
                    break;
                  }
                }
              } catch {}
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.log(`Booking form ready after ${Date.now() - formWaitStart}ms`);
            console.log('Current URL after Agree:', page.url());
          } else {
            console.log('No Agree button found - form may already be visible');
          }
        } catch (error: any) {
          console.log('Error with Agree button:', error.message);
        }
      } else {
        console.log('Not on libauth or /book page, skipping Agree button check');
      }
      
      // Look for the booking confirmation button
      try {
        // Wait for the Reserve button to be visible (it might be in a hidden form initially)
        console.log('Looking for Reserve button...');
        
        const reserveButton = await page.$('#btn-form-submit');
        if (reserveButton) {
          // Check if the button is visible
          const isVisible = await page.evaluate((btn: any) => {
            const rect = btn.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }, reserveButton);
          
          if (isVisible) {
            console.log('Found visible Reserve button (#btn-form-submit), clicking it...');
            await reserveButton.click();
            console.log('Clicked Reserve button');
            
            // Poll for booking completion (check every 100ms, max 5s)
            const completionStart = Date.now();
            let completed = false;
            while (!completed && Date.now() - completionStart < 5000) {
              const currentUrl = page.url();
              if (currentUrl.includes('confirmation') || currentUrl.includes('success')) {
                completed = true;
                break;
              }
              // Also check page content
              try {
                const pageContent = await page.content();
                if (pageContent.includes('reservation') || pageContent.includes('booked') || pageContent.includes('confirmed')) {
                  completed = true;
                  break;
                }
              } catch {}
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.log(`Booking completed after ${Date.now() - completionStart}ms`);
            
            const finalUrl = page.url();
            console.log('Final URL after Reserve:', finalUrl);
            
            // Check if booking was successful
            if (finalUrl.includes('confirmation') || finalUrl.includes('success')) {
              console.log('Booking appears successful!');
              return {
                success: true,
                bookingId: 'booking_' + Date.now()
              };
            }
            
            // Check page content for success message
            const pageContent = await page.content();
            if (pageContent.includes('reservation') || pageContent.includes('booked') || pageContent.includes('confirmed')) {
              console.log('Booking confirmed based on page content');
              return {
                success: true,
                bookingId: 'booking_' + Date.now()
              };
            }
          } else {
            console.log('Reserve button exists but is not visible yet');
          }
        } else {
          console.log('Reserve button (#btn-form-submit) not found');
        }
        
        // Fallback to old logic if specific button not found
        const bookButtonSelectors = [
          '#btn-form-submit', // Specific ID for Reserve button
          'button:has-text("Reserve")',
          'button[type="submit"]',
          'input[type="submit"]',
          'a.btn-primary',
          'button.btn-primary',
          'input.btn-primary'
        ];
        
        let buttonFound = false;
        for (const selector of bookButtonSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 3000 });
            console.log('Found booking button with selector:', selector);
            await page.click(selector);
            console.log('Clicked booking button');
            buttonFound = true;
            break;
          } catch (e) {
            // Try next selector
          }
        }
        
        if (!buttonFound) {
          await page.close();
          return {
            success: false,
            error: 'Could not find booking button'
          };
        }
        
        // Poll for page to load after button click (check every 100ms, max 2s)
        const navStart = Date.now();
        await new Promise(resolve => setTimeout(resolve, 100));
        while (Date.now() - navStart < 2000) {
          try {
            const state = await page.evaluate(() => document.readyState);
            if (state === 'complete') break;
          } catch {}
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log(`Page loaded after ${Date.now() - navStart}ms`);
        
        // Step 2: Look for and click "Continue" or "Next" or "Navigate" button
        const continueButtonSelectors = [
          'button:has-text("Continue")',
          'button:has-text("Next")',
          'button:has-text("Navigate")',
          'input[value="Continue"]',
          'input[value="Next"]',
          'a:has-text("Continue")',
          'a:has-text("Next")',
          'button[type="submit"]',  // Another submit button
          '.btn-primary'  // Primary button
        ];
        
        for (const selector of continueButtonSelectors) {
          try {
            const element = await page.$(selector);
            if (element) {
              console.log('Found continue button with selector:', selector);
              const clickStart = Date.now();
              await element.click();
              console.log('Clicked continue button');
              // Small delay to allow click to register
              await new Promise(resolve => setTimeout(resolve, 100));
              console.log(`Continue button processed in ${Date.now() - clickStart}ms`);
              break;
            }
          } catch (e) {
            // Try next selector
          }
        }
        
        // Step 3: Look for final confirmation button if needed
        try {
          const finalButtonSelectors = [
            'button:has-text("Confirm")',
            'button:has-text("Complete")',
            'button:has-text("Finish")',
            'input[value="Confirm"]',
            'button[type="submit"]'
          ];
          
          for (const selector of finalButtonSelectors) {
            try {
              const element = await page.$(selector);
              if (element) {
                console.log('Found final confirmation button with selector:', selector);
                const confirmStart = Date.now();
                await element.click();
                console.log('Clicked final confirmation button');
                // Poll for confirmation to complete (check every 100ms, max 3s)
                let confirmed = false;
                while (!confirmed && Date.now() - confirmStart < 3000) {
                  const url = page.url();
                  if (url.includes('confirmation') || url.includes('success') || url.includes('complete')) {
                    confirmed = true;
                    break;
                  }
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
                console.log(`Final confirmation completed in ${Date.now() - confirmStart}ms`);
                break;
              }
            } catch (e) {
              // Try next selector
            }
          }
        } catch (e) {
          console.log('No final confirmation button found, might not be needed');
        }
        
        const finalUrl = page.url();
        console.log('Final URL after booking:', finalUrl);
        
        // Check for success indicators
        const pageContent = await page.content();
        const success = pageContent.includes('confirmed') || 
                       pageContent.includes('reserved') || 
                       pageContent.includes('booked') ||
                       pageContent.includes('success') ||
                       pageContent.includes('complete');
        
        // Clean up: close page and browser
        console.log('Closing browser and cleaning up session...');
        await page.close();
        if (session.browser) {
          await session.browser.close();
          console.log('Browser closed');
        }
        
        // Remove session from storage
        if (sessionId) {
          const { browserSessions } = await import('./auth-browser.js');
          browserSessions.delete(sessionId);
          console.log('Session cleaned up:', sessionId);
        }
        
        if (success) {
          return {
            success: true,
            message: 'Pass booked successfully!',
            bookingId: `booking-${Date.now()}`
          };
        } else {
          return {
            success: false,
            error: 'Booking may have failed. Please check your reservations.'
          };
        }
      } catch (error: any) {
        console.error('Error during booking flow:', error);
        
        // Clean up on error too
        try {
          await page.close();
          if (session.browser) {
            await session.browser.close();
          }
          if (sessionId) {
            const { browserSessions } = await import('./auth-browser.js');
            browserSessions.delete(sessionId);
          }
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }
        
        return {
          success: false,
          error: error.message || 'Failed to complete booking'
        };
      }
    } catch (error) {
      console.error(`Error booking pass ${museumId}:`, error);
      return {
        success: false,
        error: 'Booking failed'
      };
    }
  }
}