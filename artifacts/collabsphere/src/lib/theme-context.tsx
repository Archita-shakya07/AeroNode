import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'dark' | 'light' | 'sand' | 'glass';

const THEMES: Theme[] = ['dark', 'light', 'sand', 'glass'];

export const THEME_META: Record<Theme, { label: string; description: string }> = {
  dark: { label: 'Dark', description: 'The default AeroNode look.' },
  light: { label: 'Light', description: 'Clean and bright for daytime work.' },
  sand: { label: 'Sand', description: 'Warm, textured desert tones.' },
  glass: { label: 'Glassmorphism', description: 'Frosted glass over a colorful glow.' },
};

const STORAGE_KEY = 'collabsphere:theme';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  for (const t of THEMES) {
    root.classList.remove(`theme-${t}`);
  }
  root.classList.add(`theme-${theme}`);
  // Tailwind's `dark:` variant is driven by the `.dark` class; keep it in
  // sync so any shadcn component relying on it still behaves.
  root.classList.toggle('dark', theme !== 'light');
}

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && THEMES.includes(stored as Theme) ? (stored as Theme) : 'dark';
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
