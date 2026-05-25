import { redirect } from 'next/navigation';
import { FinancePage } from '@/modules/finance/components/finance-page';
import { getBootstrap } from '@/shared/api/server-api';
import { can } from '@/shared/permissions/can';

export default async function Page() {
  const bootstrap = await getBootstrap();
  if (!bootstrap || !can(bootstrap, 'finance.invoice.read')) redirect('/dashboard');
  return <FinancePage bootstrap={bootstrap} />;
}
