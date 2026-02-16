import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AxiosInstance } from 'axios';
import museumsDataJson from '../data/museums.json';
import { LibrarySystemConfig, SYSTEM_CONFIG } from './library-system.js';

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
  bookingUrl?: string;
  passId?: string;
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
  private readonly baseUrl: string;
  private readonly museums: Map<string, MuseumMetadata>;
  private readonly config: LibrarySystemConfig;
  // Cache mapping pass slug/ID to the hex museum API ID (extracted from springyPage.museum)
  private readonly museumApiIdCache: Map<string, string> = new Map();

  constructor(config: LibrarySystemConfig, museumsDataOverride?: MuseumsDataFile) {
    this.config = config;
    this.baseUrl = config.baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // Load museums into a Map for quick lookup
    const data = museumsDataOverride || museumsData;
    this.museums = new Map(
      data.museums?.map((m: MuseumMetadata) => [m.id, m]) || []
    );
  }

  getMuseumMetadata(passId: string): MuseumMetadata | undefined {
    return this.museums.get(passId);
  }

  /**
   * Extract the hex museum API ID from a pass detail page.
   * Seattle's pass pages have a JS variable: var springyPage = { museum: '3cec43a0d6e8', ... }
   * This hex ID is what the availability API needs (not the URL slug).
   * For KCLS, the URL slug IS the hex ID, so this is a no-op.
   */
  private async resolveMuseumApiId(passSlug: string): Promise<string> {
    // Check cache first
    const cached = this.museumApiIdCache.get(passSlug);
    if (cached) return cached;

    // If the slug already looks like a hex ID (KCLS style), use it directly
    if (/^[a-f0-9]{8,}$/.test(passSlug)) {
      this.museumApiIdCache.set(passSlug, passSlug);
      return passSlug;
    }

    // Fetch the pass detail page and extract springyPage.museum
    try {
      console.log(`Resolving museum API ID for slug "${passSlug}" from ${this.config.label} detail page...`);
      const response = await this.client.get(`/passes/${passSlug}`);
      const html = response.data as string;
      
      // Look for: var springyPage = { museum: '3cec43a0d6e8', ... }
      const match = html.match(/springyPage\s*=\s*\{[^}]*museum\s*:\s*'([a-f0-9]+)'/);
      if (match && match[1]) {
        const hexId = match[1];
        console.log(`Resolved slug "${passSlug}" -> museum API ID "${hexId}"`);
        this.museumApiIdCache.set(passSlug, hexId);
        return hexId;
      }
      
      console.warn(`Could not find springyPage.museum in detail page for "${passSlug}", using slug as-is`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`Pass "${passSlug}" not found on ${this.config.label} (404) during API ID resolution`);
      } else {
        console.error(`Error resolving museum API ID for "${passSlug}":`, error.message);
      }
    }

    // Fallback: use the slug as-is
    this.museumApiIdCache.set(passSlug, passSlug);
    return passSlug;
  }

  async getAllPasses(): Promise<Pass[]> {
    try {
      console.log(`Fetching real passes from ${this.config.label} website...`);
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
              imageUrl: imageUrl?.startsWith('http')
                ? imageUrl
                : this.config.imageBaseUrl
                  ? `${this.config.imageBaseUrl}${imageUrl}`
                  : undefined,
              available: true, // We'll check actual availability via the API
              metadata: this.getMuseumMetadata(id)
            });
          }
        }
      });

      console.log(`Successfully scraped ${passes.length} passes from ${this.config.label}`);
      
      if (passes.length > 0) {
        return passes;
      } else {
        console.warn(`No passes found in ${this.config.label} HTML, falling back to known passes`);
        // Fallback to known passes if scraping fails
        return this.getFallbackPasses();
      }
      
    } catch (error: any) {
      console.error(`Error scraping passes from ${this.config.label}:`, error.message);
      console.log('Falling back to known passes');
      return this.getFallbackPasses();
    }
  }

  private getFallbackPasses(): Pass[] {
    if (this.config.id !== 'kcls') {
      return [];
    }

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
      console.log(`Fetching pass details for ${id} from ${this.config.label}...`);
      const response = await this.client.get(`/passes/${id}`);
      const html = response.data as string;
      const $ = cheerio.load(html);
      
      // While we have the detail page, extract and cache the hex museum API ID
      const springyMatch = html.match(/springyPage\s*=\s*\{[^}]*museum\s*:\s*'([a-f0-9]+)'/);
      if (springyMatch && springyMatch[1]) {
        this.museumApiIdCache.set(id, springyMatch[1]);
        console.log(`Cached museum API ID for "${id}" -> "${springyMatch[1]}"`);
      }
      
      // Extract pass details from the page
      const name = $('h1.s-lc-public-header-title, .s-lc-eq-location-name, h1#s-lc-public-pt').first().text().trim();
      const description = $('.s-lc-location-description p').first().text().trim() || 
                         $('.s-lc-eq-location-description').text().trim() ||
                         $('#s-lc-public-pd').text().trim();
      
      // Get full description (may include multiple paragraphs)
      let fullDescription = '';
      $('.s-lc-location-description, .s-lc-eq-location-description, #s-lc-public-pd').each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          fullDescription += text + '\n\n';
        }
      });
      
      const imageUrl = $('.s-lc-location-image img, .s-lc-eq-location-image img').first().attr('src');
      
      // Get metadata
      const metadata = this.getMuseumMetadata(id);
      
      return {
        id,
        name: name || metadata?.name || 'Unknown Museum',
        description: description || 'No description available',
        fullDescription: fullDescription.trim() || description,
        location: this.config.label,
        imageUrl: imageUrl?.startsWith('http')
          ? imageUrl
          : this.config.imageBaseUrl
            ? `${this.config.imageBaseUrl}${imageUrl}`
            : undefined,
        available: true,
        metadata
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`Pass "${id}" not found on ${this.config.label} (404)`);
      } else {
        console.error(`Error fetching pass details for ${id} from ${this.config.label}:`, error.message || error);
      }
      return null;
    }
  }

  private formatAvailabilityParam(value: boolean): string {
    if (this.config.availabilityParamFormat === 'boolean') {
      return value ? 'true' : 'false';
    }
    return value ? '1' : '0';
  }

  async getPassAvailability(
    museumId: string,
    date: string,
    digital: boolean = true,
    physical: boolean = false,
    location: string = '0'
  ): Promise<AvailabilitySlot[]> {
    try {
      // Resolve the actual hex museum API ID (needed for Seattle where URL slug != API ID)
      const resolvedMuseumId = await this.resolveMuseumApiId(museumId);

      // Call the real availability API - returns HTML calendar
      const url = `/pass/availability/institution`;
      const params = {
        museum: resolvedMuseumId,
        date,
        digital: this.formatAvailabilityParam(digital),
        physical: this.formatAvailabilityParam(physical),
        location
      };

      console.log(`Fetching real availability for museum ${museumId} (apiId: ${resolvedMuseumId}) on ${date} (${this.config.id})`);
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
      
      console.log(`Parsed ${slots.length} availability slots from ${this.config.label} calendar`);
      return slots;
      
    } catch (error: any) {
      console.error(`Error fetching real availability for ${museumId}:`, error.message);
      
      // For debugging: log the full error details
      if (error.response) {
        console.error(`${this.config.label} API error response:`, error.response.status);
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
        digital: this.formatAvailabilityParam(digital),
        physical: this.formatAvailabilityParam(physical),
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
          const bookingUrl = new URL(href, this.baseUrl).toString();
          const pathMatch = new URL(bookingUrl).pathname.match(/\/passes\/([^/]+)\/book/);
          const museumId = pathMatch ? pathMatch[1] : '';
          const passParam = new URL(bookingUrl).searchParams.get('pass') || '';
          
          if (museumId) {
            passes.push({
              id: museumId,
              name,
              description,
              imageUrl: imageUrl?.startsWith('http') ? imageUrl : undefined,
              available: true, // If it's in this list, it's available for this date
              bookingUrl,
              passId: passParam || undefined
            });
          }
        }
      });

      console.log(`Found ${passes.length} available passes for ${date} (${this.config.id})`);
      return passes;
      
    } catch (error: any) {
      console.error(`Error fetching passes for date ${date}:`, error.message);
      
      if (error.response) {
        console.error(`${this.config.label} API error response:`, error.response.status);
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
    // DEPRECATED: This method is no longer used.
    // Booking is now handled by httpBookingService in booking-http.ts
    // which uses pure HTTP requests instead of Puppeteer browser automation.
    console.warn('[DEPRECATED] PassesService.bookPass called - use httpBookingService.bookPass instead');
    
    return {
      success: false,
      error: 'This booking method is deprecated. Please use the HTTP-based booking service.'
    };
  }
}

const passesServices: Record<'kcls' | 'seattle', PassesService> = {
  kcls: new PassesService(SYSTEM_CONFIG.kcls, museumsData),
  seattle: new PassesService(SYSTEM_CONFIG.seattle)
};

export function getPassesService(system: 'kcls' | 'seattle') {
  return passesServices[system] || passesServices.kcls;
}