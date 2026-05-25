import { MapPin, Phone, UserRound, ArrowRight } from 'lucide-react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

async function getClinicData(tenantCode: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const res = await fetch(`${API_URL}/portal/v1/public/clinics/${tenantCode}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch clinic');
  }
  return res.json() as Promise<{
    clinic: { id: string; code: string; name: string };
    branches: Array<{ id: string; name: string; address: string; phone: string }>;
  }>;
}

async function getDoctors(tenantCode: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const res = await fetch(`${API_URL}/portal/v1/public/clinics/${tenantCode}/doctors`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return { doctors: [] };
  return res.json() as Promise<{
    doctors: Array<{
      id: string;
      firstName: string;
      lastName: string;
      middleName: string;
      positions: Array<{ specialty: { name: string } }>;
    }>;
  }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantCode: string }>;
}): Promise<Metadata> {
  const { tenantCode } = await params;
  const data = await getClinicData(tenantCode);
  if (!data) return { title: 'Not Found' };

  return {
    title: `${data.clinic.name} | MedCRM`,
    description: `Запишитесь на прием в клинику ${data.clinic.name}. Лучшие специалисты, онлайн-запись.`,
    openGraph: {
      title: data.clinic.name,
      description: `Запишитесь на прием в клинику ${data.clinic.name} онлайн.`,
      type: 'website',
    },
  };
}

export default async function ClinicLandingPage({
  params,
}: {
  params: Promise<{ locale: string; tenantCode: string }>;
}) {
  const { locale, tenantCode } = await params;
  const data = await getClinicData(tenantCode);

  if (!data) notFound();

  const { clinic, branches } = data;
  const { doctors } = await getDoctors(tenantCode);
  const mainBranch = branches[0];

  // Schema.org MedicalClinic
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: clinic.name,
    address: mainBranch
      ? {
          '@type': 'PostalAddress',
          streetAddress: mainBranch.address,
          addressCountry: 'TJ', // Based on the locale/project specifics
        }
      : undefined,
    telephone: mainBranch?.phone,
  };

  return (
    <div className="space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Section */}
      <section className="bg-surface rounded-3xl p-8 md:p-12 border border-line shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-soft rounded-full -mr-32 -mt-32 blur-3xl opacity-50 pointer-events-none" />

        <div className="relative z-10 space-y-6 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold text-ink tracking-tight">{clinic.name}</h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-muted">
            {mainBranch?.address && (
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-brand" />
                <span>{mainBranch.address}</span>
              </div>
            )}
            {mainBranch?.phone && (
              <div className="flex items-center gap-2">
                <Phone size={18} className="text-brand" />
                <span>{mainBranch.phone}</span>
              </div>
            )}
          </div>
          <div className="pt-4 flex items-center gap-4">
            <Link
              href={`/${locale}/login?clinic=${tenantCode}`}
              className="px-6 py-3 bg-brand text-brand-contrast font-bold rounded-xl hover:bg-brand-strong transition-all duration-200 shadow-sm hover:shadow"
            >
              Войти и записаться
            </Link>
          </div>
        </div>
      </section>

      {/* Doctors Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-ink">Специалисты клиники</h2>
        </div>

        {doctors.length === 0 ? (
          <div className="text-center py-12 bg-surface-soft rounded-2xl border border-line">
            <p className="text-muted">Нет доступных специалистов.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {doctors.map((doctor) => {
              const fullName =
                `${doctor.lastName} ${doctor.firstName} ${doctor.middleName || ''}`.trim();
              const specialty = doctor.positions[0]?.specialty?.name || 'Врач';

              return (
                <Link
                  key={doctor.id}
                  href={`/${locale}/clinics/${tenantCode}/doctors/${doctor.id}`}
                  className="group flex flex-col p-5 bg-surface rounded-2xl border border-line hover:border-brand/30 hover:shadow-md transition-all duration-200"
                >
                  <div className="w-16 h-16 rounded-2xl bg-surface-soft flex items-center justify-center text-brand mb-4">
                    <UserRound size={28} />
                  </div>
                  <h3 className="font-semibold text-ink group-hover:text-brand transition-colors line-clamp-2">
                    {fullName}
                  </h3>
                  <p className="text-sm text-muted mt-1 mb-4">{specialty}</p>

                  <div className="mt-auto flex items-center gap-2 text-sm font-medium text-brand">
                    <span>Подробнее</span>
                    <ArrowRight
                      size={16}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
