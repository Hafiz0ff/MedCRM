import type { Preview } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';
import React, { useEffect } from 'react';
import '../app/globals.css';
import enMessages from '../i18n/en.json';
import ruMessages from '../i18n/ru.json';
import tjMessages from '../i18n/tj.json';
import uzMessages from '../i18n/uz.json';

const messagesMap: Record<string, any> = {
  ru: ruMessages,
  tj: tjMessages,
  en: enMessages,
  uz: uzMessages,
};

const withProviders = (Story: any, context: any) => {
  const { theme = 'light', density = 'comfortable', locale = 'ru' } = context.globals;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-density', density);
    root.style.colorScheme = theme === 'high-contrast' ? 'dark' : theme;
  }, [theme, density]);

  const messages = messagesMap[locale] || ruMessages;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen bg-bg text-ink p-4">
        <Story />
      </div>
    </NextIntlClientProvider>
  );
};

export const globalTypes = {
  theme: {
    name: 'Theme',
    description: 'Global theme for components',
    defaultValue: 'light',
    toolbar: {
      icon: 'circlehollow',
      items: [
        { value: 'light', title: 'Light' },
        { value: 'dark', title: 'Dark' },
        { value: 'high-contrast', title: 'High Contrast' },
      ],
      showName: true,
    },
  },
  density: {
    name: 'Density',
    description: 'Interface density spacing',
    defaultValue: 'comfortable',
    toolbar: {
      icon: 'sidebyside',
      items: [
        { value: 'comfortable', title: 'Comfortable' },
        { value: 'compact', title: 'Compact' },
      ],
      showName: true,
    },
  },
  locale: {
    name: 'Locale',
    description: 'Internationalization locale',
    defaultValue: 'ru',
    toolbar: {
      icon: 'globe',
      items: [
        { value: 'ru', title: 'Русский (RU)' },
        { value: 'tj', title: 'Тоҷикӣ (TJ)' },
        { value: 'en', title: 'English (EN)' },
        { value: 'uz', title: 'Oʻzbekcha (UZ)' },
      ],
      showName: true,
    },
  },
};

const preview: Preview = {
  decorators: [withProviders],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
