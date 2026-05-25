import { redirect } from 'next/navigation';
import { DashboardView } from './dashboard-view';
import { getBootstrap } from '@/shared/api/server-api';

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  const bootstrap = await getBootstrap();

  if (!bootstrap) {
    redirect(`/${locale}/auth/login`);
    return null;
  }

  return <DashboardView bootstrap={bootstrap} />;
}
