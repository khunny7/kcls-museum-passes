export type LibrarySystem = 'kcls' | 'seattle';

export interface LibrarySystemConfig {
  id: LibrarySystem;
  label: string;
  baseUrl: string;
  authId: string;
  loginCallbackUrl: string;
  authPostUrl: string;
  availabilityParamFormat: 'numeric' | 'boolean';
  imageBaseUrl?: string;
  defaultBookingPath: (date: string) => string;
  refererBase: string;
  /** How many days in advance passes become available */
  advanceDays: number;
  /** Hour in Pacific time (local) when new passes open. KCLS: 14 (2 PM), Seattle: 12 (noon) */
  openHourPacific: number;
}

export const DEFAULT_LIBRARY_SYSTEM: LibrarySystem = 'kcls';

export const SYSTEM_CONFIG: Record<LibrarySystem, LibrarySystemConfig> = {
  kcls: {
    id: 'kcls',
    label: 'King County Library System',
    baseUrl: 'https://rooms.kcls.org',
    authId: '1963',
    loginCallbackUrl: 'https://kcls.libapps.com/libapps/libauth?auth_id=1963',
    authPostUrl: 'https://libauth.com/form_login',
    availabilityParamFormat: 'numeric',
    imageBaseUrl: 'https://d2jv02qf7xgjwx.cloudfront.net',
    defaultBookingPath: (date) => `/passes/33c1f0af9b02/book?date=${date}&pass=anypass&digital=1&physical=0&location=0`,
    refererBase: 'https://rooms.kcls.org/passes',
    advanceDays: 14,
    openHourPacific: 14, // 2 PM Pacific time
  },
  seattle: {
    id: 'seattle',
    label: 'Seattle Public Library',
    baseUrl: 'https://spl.libcal.com',
    authId: '3001',
    loginCallbackUrl: 'https://spl.libapps.com/libapps/libauth?auth_id=3001',
    authPostUrl: 'https://libauth.com/form_login',
    availabilityParamFormat: 'boolean',
    defaultBookingPath: (date) => `/passes/Childrens/book?pass=anypass&date=${date}&digital=1&physical=0&location=0`,
    refererBase: 'https://spl.libcal.com/passes',
    advanceDays: 31,
    openHourPacific: 12, // noon Pacific time
  }
};

export function parseLibrarySystem(value: unknown): LibrarySystem {
  if (value === 'seattle') return 'seattle';
  return 'kcls';
}
