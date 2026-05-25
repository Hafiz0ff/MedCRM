import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ReactNode, use } from 'react';

interface PublicLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default function PublicLayout({ children, params }: PublicLayoutProps) {
  const { locale } = use(params);
  // Assuming a 'public' namespace in translations, but we can hardcode for MVP if missing
  // const t = useTranslations('public');

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      {/* Public Header */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-line">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`/${locale}/clinics`} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
              MC
            </div>
            <span className="text-xl font-bold text-ink tracking-tight">MedCRM Directory</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href={`/${locale}/clinics`}
              className="text-sm font-medium text-text hover:text-brand transition-colors"
            >
              Клиники
            </Link>
            <Link
              href={`/${locale}/login`}
              className="px-4 py-2 bg-brand text-brand-contrast font-medium text-sm rounded-lg hover:bg-brand-strong transition-colors"
            >
              Войти
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">{children}</main>

      {/* Public Footer */}
      <footer className="bg-surface border-t border-line py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted text-sm">
          &copy; {new Date().getFullYear()} MedCRM. Все права защищены.
        </div>
      </footer>
    </div>
  );
}
