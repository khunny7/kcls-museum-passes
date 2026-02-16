export type LibrarySystem = 'kcls' | 'seattle';

export const DEFAULT_LIBRARY_SYSTEM: LibrarySystem = 'kcls';

export const LIBRARY_SYSTEM_LABELS: Record<LibrarySystem, string> = {
  kcls: 'King County Library System',
  seattle: 'Seattle Public Library'
};

export const STORAGE_KEYS = {
  system: 'library_system',
  credentials: (system: LibrarySystem) => `library_credentials_${system}`,
  authSession: (system: LibrarySystem) => `library_auth_session_${system}`
};

export interface SystemTheme {
  /** gradient blobs behind the page */
  blob1: string
  blob2: string
  blob3: string
  /** header icon badge gradient */
  iconGradient: string
  /** small "Piano8283 Studio" label color */
  studioLabel: string
  /** active nav pill */
  navActive: string
  navActiveShadow: string
  /** header ring accent (border ring around the bar) */
  headerRing: string
  /** select focus ring */
  selectFocus: string
  selectFocusRing: string
  /** credentials button (when NOT saved) */
  credBtn: string
  credBtnHover: string
  credBtnShadow: string
}

export interface SystemScheduleConfig {
  /** How many days in advance passes become available */
  advanceDays: number
  /** Hour in UTC when new passes open */
  openHourUTC: number
  /** Human-readable description of the open time */
  openTimeLabel: string
}

export const SYSTEM_SCHEDULE: Record<LibrarySystem, SystemScheduleConfig> = {
  kcls: {
    advanceDays: 14,
    openHourUTC: 22, // 2 PM PST
    openTimeLabel: '2:00 PM PST',
  },
  seattle: {
    advanceDays: 31,
    openHourUTC: 20, // 12 PM (noon) PST
    openTimeLabel: '12:00 PM PST',
  },
}

export const SYSTEM_THEMES: Record<LibrarySystem, SystemTheme> = {
  kcls: {
    blob1: 'from-blue-300 via-sky-200 to-indigo-200',
    blob2: 'bg-blue-200',
    blob3: 'bg-indigo-200',
    iconGradient: 'from-blue-500 via-sky-500 to-indigo-500',
    studioLabel: 'text-blue-600',
    navActive: 'bg-blue-600',
    navActiveShadow: 'shadow-blue-500/30',
    headerRing: 'ring-white/50',
    selectFocus: 'focus:border-blue-400',
    selectFocusRing: 'focus:ring-blue-400/30',
    credBtn: 'bg-blue-600',
    credBtnHover: 'hover:bg-blue-700',
    credBtnShadow: 'shadow-blue-500/20',
  },
  seattle: {
    blob1: 'from-amber-300 via-orange-200 to-yellow-200',
    blob2: 'bg-amber-200',
    blob3: 'bg-orange-200',
    iconGradient: 'from-amber-500 via-orange-500 to-yellow-500',
    studioLabel: 'text-amber-600',
    navActive: 'bg-amber-600',
    navActiveShadow: 'shadow-amber-500/30',
    headerRing: 'ring-amber-100/60',
    selectFocus: 'focus:border-amber-400',
    selectFocusRing: 'focus:ring-amber-400/30',
    credBtn: 'bg-amber-600',
    credBtnHover: 'hover:bg-amber-700',
    credBtnShadow: 'shadow-amber-500/20',
  },
};
