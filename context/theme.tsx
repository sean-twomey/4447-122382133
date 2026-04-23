import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark';

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'light',
  setPreference: () => {},
});

// Initialize storage
const storage = new SQLiteStorage('theme-prefs.db');
const STORAGE_KEY = 'themePreference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('light');

  useEffect(() => {
    storage.getItemAsync(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setPreferenceState(saved);
      }
    });
  }, []);

  function setPreference(p: ThemePreference) {
    setPreferenceState(p);
    storage.setItemAsync(STORAGE_KEY, p);
  }

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
