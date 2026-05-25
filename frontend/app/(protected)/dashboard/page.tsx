import { redirect } from 'next/navigation';
import { DashboardView } from './dashboard-view';
import { getBootstrap } from '@/shared/api/server-api';

export default async function DashboardPage() {
  const bootstrap = await getBootstrap();
  if (!bootstrap) {
    redirect('/auth/login');
  }

  return <DashboardView bootstrap={bootstrap} />;
}
