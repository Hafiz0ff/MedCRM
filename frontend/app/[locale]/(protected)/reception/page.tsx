import { redirect } from 'next/navigation';
import { ReceptionBoard } from '@/modules/reception/components/reception-board';
import { getBootstrap } from '@/shared/api/server-api';
import { can } from '@/shared/permissions/can';

export default async function Page() {
  const bootstrap = await getBootstrap();
  if (!bootstrap || !can(bootstrap, 'reception.dashboard.read')) redirect('/dashboard');
  return <ReceptionBoard bootstrap={bootstrap} />;
}
