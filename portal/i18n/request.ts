import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  const locales = ['ru', 'tj', 'en', 'uz'];

  if (!locale || !locales.includes(locale)) {
    locale = 'ru';
  }

  return {
    locale,
    messages: (await import(`./${locale}.json`)).default,
  };
});
