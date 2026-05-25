import { redirect } from 'next/navigation';
import { CommunicationsStudio } from '@/modules/communications/components/communications-studio';
import { getBootstrap } from '@/shared/api/server-api';
import { can } from '@/shared/permissions/can';

export default async function Page() {
  const bootstrap = await getBootstrap();
  if (!bootstrap) redirect('/auth/login');
  if (!can(bootstrap, 'communications.rule.manage')) redirect('/dashboard');

  return <CommunicationsStudio bootstrap={bootstrap} />;
}
