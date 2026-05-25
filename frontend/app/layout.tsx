import { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'MedCRM',
  description: 'Cloud-first SaaS CRM/MIS platform for clinics',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
