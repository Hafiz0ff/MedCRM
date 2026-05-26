import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import { TopNav } from '@/modules/shell/components/top-nav';
import { getBootstrap } from '@/shared/api/server-api';
import { AppQueryProvider } from '@/shared/query/query-provider';

interface ProtectedLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function ProtectedLayout({ children, params }: ProtectedLayoutProps) {
  const { locale } = await params;
  const bootstrap = await getBootstrap();

  if (!bootstrap) {
    redirect(`/${locale}/auth/login`);
    return null;
  }

  return (
    <div className="shell">
      <TopNav bootstrap={bootstrap} />
      <main className="main">
        <AppQueryProvider>{children}</AppQueryProvider>
      </main>
    </div>
  );
}
