'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Stethoscope,
  Users
} from 'lucide-react';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { can, moduleEnabled } from '@/shared/permissions/can';

type NavItem = {
  href: string;
  label: string;
  module: string;
  permission: string;
  group: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Операционная панель',
    module: 'auth',
    permission: 'auth.bootstrap.read',
    group: 'Операции',
    icon: LayoutDashboard
  },
  {
    href: '/reception',
    label: 'Регистратура',
    module: 'receptionist-workplace',
    permission: 'reception.dashboard.read',
    group: 'Операции',
    icon: ClipboardList
  },
  {
    href: '/schedule',
    label: 'Расписание',
    module: 'smart-scheduling',
    permission: 'scheduling.calendar.read',
    group: 'Операции',
    icon: CalendarDays
  },
  {
    href: '/patients',
    label: 'Пациенты',
    module: 'patient-crm',
    permission: 'patients.read',
    group: 'CRM',
    icon: Users
  }
];

export function Sidebar({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => moduleEnabled(bootstrap, item.module) && can(bootstrap, item.permission));
  const groupedItems = visibleItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    acc[item.group] = [...(acc[item.group] ?? []), item];
    return acc;
  }, {});

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="brand-mark">
          <Stethoscope size={19} />
        </span>
        <div className="sidebar-title">
          <strong>MedCRM</strong>
          <span>Clinic OS</span>
        </div>
      </div>

      {Object.entries(groupedItems).map(([group, items]) => (
        <section className="nav-section" key={group}>
          <div className="nav-section-label">{group}</div>
          <nav className="nav" aria-label={group}>
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link className={active ? 'active' : undefined} key={item.href} href={item.href}>
                  <Icon size={18} strokeWidth={2.2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </section>
      ))}

      <section className="nav-section">
        <div className="nav-section-label">Скоро</div>
        <nav className="nav" aria-label="Будущие модули">
          <Link href="/dashboard">
            <CreditCard size={18} strokeWidth={2.2} />
            Финансы
          </Link>
          <Link href="/dashboard">
            <MessageSquare size={18} strokeWidth={2.2} />
            Коммуникации
          </Link>
          <Link href="/dashboard">
            <BarChart3 size={18} strokeWidth={2.2} />
            BI
          </Link>
          <Link href="/dashboard">
            <Settings size={18} strokeWidth={2.2} />
            Настройки
          </Link>
        </nav>
      </section>

      <div className="sidebar-footer">
        <span>Активные модули</span>
        <strong>{bootstrap.enabledModules.length} подключено</strong>
        <span>{bootstrap.permissions.length} прав доступа</span>
      </div>
    </aside>
  );
}
