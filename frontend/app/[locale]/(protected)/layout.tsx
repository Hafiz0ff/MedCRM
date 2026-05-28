import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import { TopNav } from '@/modules/shell/components/top-nav';
import { getBootstrap } from '@/shared/api/server-api';
import { AppQueryProvider } from '@/shared/query/query-provider';
import { BrandingInjector } from '@/shared/ui/branding-injector';

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

  // Resolve branding custom accents with default fallback
  const brand = bootstrap.tenant.branding?.brandColor || '220 90% 56%';
  const accent = bootstrap.tenant.branding?.accentColor || '142 70% 45%';

  return (
    <div className="shell">
      {/* Server side brand variable styles rendering */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        :root {
          --brand-hsl: ${brand};
          --accent-hsl: ${accent};
          --brand: hsl(var(--brand-hsl));
          --accent: hsl(var(--accent-hsl));
          --brand-strong: color-mix(in srgb, var(--brand) 85%, black);
          --brand-soft: color-mix(in srgb, var(--brand) 12%, transparent);
          --accent-strong: color-mix(in srgb, var(--accent) 85%, black);
          --accent-soft: color-mix(in srgb, var(--accent) 12%, transparent);
        }
        :root[data-theme='dark'] {
          --brand-strong: color-mix(in srgb, var(--brand) 85%, white);
          --accent-strong: color-mix(in srgb, var(--accent) 85%, white);
        }
      `,
        }}
      />
      <BrandingInjector defaultBrand={brand} defaultAccent={accent} />
      <TopNav bootstrap={bootstrap} />
      <main className="main">
        <AppQueryProvider>{children}</AppQueryProvider>
      </main>
    </div>
  );
}
