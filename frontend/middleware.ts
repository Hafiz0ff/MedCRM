import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match only internationalized pathnames, excluding api routes and static/public assets
  matcher: ['/', '/(ru|tj|en|uz)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
