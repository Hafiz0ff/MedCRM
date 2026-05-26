'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/shared/theme/theme-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <Sun className={`theme-toggle-icon${isDark ? ' is-hidden' : ''}`} size={16} />
      <Moon className={`theme-toggle-icon${isDark ? '' : ' is-hidden'}`} size={16} />
    </button>
  );
}
