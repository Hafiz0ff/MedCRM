'use client';

import { Sun, Moon, Eye, Globe, Sliders } from 'lucide-react';
import { useLocale } from 'next-intl';
import React from 'react';
import { useRouter, usePathname } from '@/i18n/routing';
import { useDensity } from '@/shared/theme/density-provider';
import { useTheme } from '@/shared/theme/theme-provider';

export function AppearanceSelector() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { density, setDensity } = useDensity();

  const handleLocaleChange = (nextLocale: 'ru' | 'tj' | 'en' | 'uz') => {
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-surface border border-border rounded-lg shadow-sm">
      {/* Language Selector */}
      <div className="flex items-center gap-1.5">
        <Globe className="h-4 w-4 text-muted" />
        <select
          value={locale}
          onChange={(e) => handleLocaleChange(e.target.value as any)}
          className="bg-transparent text-sm font-medium text-ink focus:outline-hidden cursor-pointer"
        >
          <option value="ru" className="bg-surface text-ink">
            Русский
          </option>
          <option value="tj" className="bg-surface text-ink">
            Тоҷикӣ
          </option>
          <option value="en" className="bg-surface text-ink">
            English
          </option>
          <option value="uz" className="bg-surface text-ink">
            Oʻzbekcha
          </option>
        </select>
      </div>

      <div className="h-4 w-px bg-border hidden sm:block" />

      {/* Theme Selector */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setTheme('light')}
          className={`p-1.5 rounded-md transition-colors ${
            theme === 'light'
              ? 'bg-brand/10 text-brand'
              : 'text-muted hover:bg-surface-soft hover:text-ink'
          }`}
          title="Light Mode"
        >
          <Sun className="h-4 w-4" />
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`p-1.5 rounded-md transition-colors ${
            theme === 'dark'
              ? 'bg-brand/10 text-brand'
              : 'text-muted hover:bg-surface-soft hover:text-ink'
          }`}
          title="Dark Mode"
        >
          <Moon className="h-4 w-4" />
        </button>
        <button
          onClick={() => setTheme('high-contrast')}
          className={`p-1.5 rounded-md transition-colors ${
            theme === 'high-contrast'
              ? 'bg-brand/10 text-brand'
              : 'text-muted hover:bg-surface-soft hover:text-ink'
          }`}
          title="High Contrast Mode"
        >
          <Eye className="h-4 w-4" />
        </button>
      </div>

      <div className="h-4 w-px bg-border hidden sm:block" />

      {/* Density Selector */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setDensity('comfortable')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
            density === 'comfortable'
              ? 'bg-brand/10 text-brand'
              : 'text-muted hover:bg-surface-soft hover:text-ink'
          }`}
          title="Comfortable Density"
        >
          Comfortable
        </button>
        <button
          onClick={() => setDensity('compact')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
            density === 'compact'
              ? 'bg-brand/10 text-brand'
              : 'text-muted hover:bg-surface-soft hover:text-ink'
          }`}
          title="Compact Density"
        >
          Compact
        </button>
      </div>
    </div>
  );
}
