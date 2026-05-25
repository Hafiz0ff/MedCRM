import { redirect } from 'next/navigation';
import { getBootstrap } from '@/shared/api/server-api';

interface LocalePageProps {
  params: Promise<{ locale: string }>;
}

export default async function LocalePage({ params }: LocalePageProps) {
  const { locale } = await params;
  const bootstrap = await getBootstrap();

  if (!bootstrap) {
    redirect(`/${locale}/auth/login`);
  } else {
    redirect(`/${locale}/dashboard`);
  }
}
