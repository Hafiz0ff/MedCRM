import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { ReactNode } from 'react';
import { AppQueryProvider } from '@/shared/query/query-provider';
import { DensityProvider } from '@/shared/theme/density-provider';
import { ThemeProvider } from '@/shared/theme/theme-provider';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const locales = ['ru', 'tj', 'en', 'uz'];

  if (!locales.includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AppQueryProvider>
        <ThemeProvider>
          <DensityProvider>{children}</DensityProvider>
        </ThemeProvider>
      </AppQueryProvider>
    </NextIntlClientProvider>
  );
}
