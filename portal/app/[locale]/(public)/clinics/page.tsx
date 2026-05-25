import { Building2, ChevronRight } from 'lucide-react';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Клиники | MedCRM Directory',
  description: 'Найдите лучшую клинику и запишитесь на прием онлайн через MedCRM.',
};

async function getClinics() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const res = await fetch(`${API_URL}/portal/v1/public/clinics`, {
    next: { revalidate: 60 }, // ISR: Revalidate every 60 seconds
  });
  if (!res.ok) throw new Error('Failed to fetch clinics');
  return res.json() as Promise<{ clinics: Array<{ id: string; code: string; name: string }> }>;
}

export default async function ClinicsDirectoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { clinics } = await getClinics();

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-ink">Каталог Клиник</h1>
        <p className="text-lg text-muted max-w-2xl mx-auto">
          Выберите клинику из нашего каталога, чтобы посмотреть доступных врачей и записаться на
          прием онлайн.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clinics.map((clinic) => (
          <Link
            key={clinic.id}
            href={`/${locale}/clinics/${clinic.code}`}
            className="group flex flex-col p-6 rounded-2xl bg-surface border border-line shadow-sm hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-soft flex items-center justify-center text-brand">
                <Building2 size={24} />
              </div>
              <ChevronRight className="text-muted group-hover:text-brand transition-colors" />
            </div>
            <h2 className="text-xl font-semibold text-ink mb-2 group-hover:text-brand transition-colors">
              {clinic.name}
            </h2>
            <p className="text-sm text-muted mt-auto">Записаться онлайн →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
