import { redirect } from 'next/navigation';
import { AnalyticsDashboard } from '@/modules/analytics/components/analytics-dashboard';
import { getBootstrap } from '@/shared/api/server-api';

export default async function Page() {
  const bootstrap = await getBootstrap();
  if (!bootstrap) redirect('/auth/login');

  return <AnalyticsDashboard />;
}
