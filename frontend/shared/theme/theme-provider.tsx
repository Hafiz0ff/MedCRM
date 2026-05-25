'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'high-contrast' | 'system';

interface ThemeContextProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    const savedTheme = localStorage.getItem('color-scheme') as Theme;
    if (savedTheme) {
      setThemeState(savedTheme);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('color-scheme', newTheme);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    const meta = window.document.querySelector('meta[name="color-scheme"]');

    const updateTheme = () => {
      let resolvedTheme: 'light' | 'dark' | 'high-contrast' = 'light';
      let colorSchemeValue = 'light dark';

      if (theme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        resolvedTheme = systemPrefersDark ? 'dark' : 'light';
        colorSchemeValue = 'light dark';
      } else {
        resolvedTheme = theme as 'light' | 'dark' | 'high-contrast';
        colorSchemeValue = theme === 'high-contrast' ? 'dark' : theme;
      }

      root.setAttribute('data-theme', resolvedTheme);
      root.style.colorScheme = resolvedTheme === 'high-contrast' ? 'dark' : resolvedTheme;

      if (meta) {
        meta.setAttribute('content', colorSchemeValue);
      }
    };

    updateTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => updateTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
