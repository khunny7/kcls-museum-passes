import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { DEFAULT_LIBRARY_SYSTEM, LIBRARY_SYSTEM_LABELS, STORAGE_KEYS, type LibrarySystem } from '../utils/librarySystem';

interface LibrarySystemContextValue {
  system: LibrarySystem;
  setSystem: (system: LibrarySystem) => void;
  label: string;
}

const LibrarySystemContext = createContext<LibrarySystemContextValue | undefined>(undefined);

interface LibrarySystemProviderProps {
  children: ReactNode;
}

export function LibrarySystemProvider({ children }: LibrarySystemProviderProps) {
  const [system, setSystemState] = useState<LibrarySystem>(DEFAULT_LIBRARY_SYSTEM);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.system);
    if (stored === 'seattle' || stored === 'kcls') {
      setSystemState(stored);
    }
  }, []);

  const setSystem = (next: LibrarySystem) => {
    setSystemState(next);
    localStorage.setItem(STORAGE_KEYS.system, next);
  };

  const value = useMemo(() => ({
    system,
    setSystem,
    label: LIBRARY_SYSTEM_LABELS[system]
  }), [system]);

  return <LibrarySystemContext.Provider value={value}>{children}</LibrarySystemContext.Provider>;
}

export function useLibrarySystem() {
  const context = useContext(LibrarySystemContext);
  if (!context) {
    throw new Error('useLibrarySystem must be used within a LibrarySystemProvider');
  }
  return context;
}
