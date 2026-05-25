import { redirect } from 'next/navigation';
import { SettingsPage } from '@/modules/system-admin/components/settings-page';
import { getBootstrap } from '@/shared/api/server-api';
import { can } from '@/shared/permissions/can';

export default async function Page() {
  const bootstrap = await getBootstrap();
  if (!bootstrap) redirect('/auth/login');
  if (!can(bootstrap, 'system.settings.read')) redirect('/dashboard');
  return <SettingsPage bootstrap={bootstrap} />;
}
