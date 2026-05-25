import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ru', 'tj', 'en', 'uz'],
  defaultLocale: 'ru',
  localePrefix: 'always',
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
