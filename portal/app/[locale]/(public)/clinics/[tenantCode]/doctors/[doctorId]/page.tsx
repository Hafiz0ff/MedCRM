import { CalendarPlus, MapPin, UserRound, ArrowLeft } from 'lucide-react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

async function getDoctorData(tenantCode: string, doctorId: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const res = await fetch(`${API_URL}/portal/v1/public/clinics/${tenantCode}/doctors/${doctorId}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch doctor');
  }
  return res.json() as Promise<{
    doctor: {
      id: string;
      firstName: string;
      lastName: string;
      middleName: string;
      positions: Array<{
        specialty: { id: string; name: string };
        position: { name: string };
        branch: { name: string; address: string };
      }>;
    };
  }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantCode: string; doctorId: string }>;
}): Promise<Metadata> {
  const { tenantCode, doctorId } = await params;
  const data = await getDoctorData(tenantCode, doctorId);
  if (!data) return { title: 'Not Found' };

  const { doctor } = data;
  const fullName = `${doctor.lastName} ${doctor.firstName} ${doctor.middleName || ''}`.trim();
  const specialty = doctor.positions[0]?.specialty?.name || 'Врач';

  return {
    title: `${fullName} - ${specialty} | MedCRM`,
    description: `Запишитесь на прием к врачу ${fullName} (${specialty}). Отзывы, расписание, онлайн-запись.`,
    openGraph: {
      title: `${fullName} - ${specialty}`,
      description: `Запишитесь на прием к врачу ${fullName} онлайн.`,
      type: 'profile',
    },
  };
}

export default async function DoctorLandingPage({
  params,
}: {
  params: Promise<{ locale: string; tenantCode: string; doctorId: string }>;
}) {
  const { locale, tenantCode, doctorId } = await params;
  const data = await getDoctorData(tenantCode, doctorId);

  if (!data) notFound();

  const { doctor } = data;
  const fullName = `${doctor.lastName} ${doctor.firstName} ${doctor.middleName || ''}`.trim();
  const primaryPosition = doctor.positions[0];
  const specialty = primaryPosition?.specialty?.name || 'Врач';
  const branch = primaryPosition?.branch;

  // Schema.org Physician
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: fullName,
    medicalSpecialty: specialty,
    location: branch
      ? {
          '@type': 'Place',
          name: branch.name,
          address: {
            '@type': 'PostalAddress',
            streetAddress: branch.address,
          },
        }
      : undefined,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href={`/${locale}/clinics/${tenantCode}`}
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-brand transition-colors"
      >
        <ArrowLeft size={16} />
        Назад к списку врачей
      </Link>

      <div className="bg-surface rounded-3xl border border-line shadow-sm overflow-hidden flex flex-col md:flex-row">
        {/* Photo Section */}
        <div className="md:w-1/3 bg-surface-soft p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-line">
          <div className="w-32 h-32 rounded-full bg-surface shadow-sm flex items-center justify-center text-brand mb-6 border-4 border-white">
            <UserRound size={48} strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-ink leading-tight mb-2">{fullName}</h1>
            <span className="inline-block px-3 py-1 bg-brand-soft text-brand text-sm font-semibold rounded-full">
              {specialty}
            </span>
          </div>
        </div>

        {/* Details & CTA Section */}
        <div className="flex-1 p-8 md:p-12 flex flex-col justify-center">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-ink mb-3">О специалисте</h2>
              <p className="text-muted leading-relaxed">
                Доктор ведет прием пациентов, осуществляет диагностику и лечение заболеваний по
                своей специализации. Регулярно повышает квалификацию и использует современные методы
                доказательной медицины.
              </p>
            </div>

            {branch && (
              <div className="bg-surface-soft rounded-xl p-4 flex items-start gap-3">
                <MapPin size={20} className="text-brand shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-ink">{branch.name}</div>
                  <div className="text-sm text-muted mt-1">{branch.address}</div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-line">
              {/* Redirects to login, passing clinic and doctor IDs so the portal can open booking wizard instantly */}
              <Link
                href={`/${locale}/login?clinic=${tenantCode}&doctorId=${doctorId}&specialtyId=${primaryPosition?.specialty?.id || ''}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-brand text-brand-contrast font-bold text-lg rounded-xl hover:bg-brand-strong transition-all shadow-sm hover:shadow-md"
              >
                <CalendarPlus size={22} />
                Записаться на прием
              </Link>
              <p className="text-sm text-center sm:text-left text-muted mt-3">
                Вы будете перенаправлены в личный кабинет для выбора времени.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
