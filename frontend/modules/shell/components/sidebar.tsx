'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import {
  CalendarDays,
  ClipboardList,
  FileText,
  LogOut,
  LayoutDashboard,
  Settings,
  Stethoscope,
  UserRoundCheck,
  Users,
  WalletCards
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
    label: 'Операционная',
    module: 'auth',
    permission: 'auth.bootstrap.read',
    group: 'Рабочая зона',
    icon: LayoutDashboard
  },
  {
    href: '/reception',
    label: 'Живая очередь',
    module: 'receptionist-workplace',
    permission: 'reception.dashboard.read',
    group: 'Рабочая зона',
    icon: ClipboardList
  },
  {
    href: '/schedule',
    label: 'Расписание',
    module: 'smart-scheduling',
    permission: 'scheduling.calendar.read',
    group: 'Рабочая зона',
    icon: CalendarDays
  },
  {
    href: '/patients',
    label: 'Пациенты',
    module: 'patient-crm',
    permission: 'patients.read',
    group: 'Рабочая зона',
    icon: Users
  },
  {
    href: '/finance',
    label: 'Финансы',
    module: 'finance-billing',
    permission: 'finance.invoice.read',
    group: 'Управление',
    icon: WalletCards
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
          <strong>{bootstrap.tenant.name}</strong>
          <span>{bootstrap.tenant.subscriptionPlan}</span>
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
        <div className="nav-section-label">Управление</div>
        <nav className="nav" aria-label="Управление клиникой">
          <Link href="/doctors">
            <UserRoundCheck size={18} strokeWidth={2.2} />
            Врачи
          </Link>
          <Link href="/dashboard" className="nav-disabled" aria-disabled="true">
            <FileText size={18} strokeWidth={2.2} />
            Отчёты
          </Link>
          <Link href="/dashboard" className="nav-disabled" aria-disabled="true">
            <Settings size={18} strokeWidth={2.2} />
            Настройки
          </Link>
        </nav>
      </section>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="sidebar-user-avatar">АД</span>
          <div>
            <strong>Администратор</strong>
            <span>{bootstrap.enabledModules.length} модулей · {bootstrap.permissions.length} прав</span>
          </div>
          <LogOut size={16} className="muted" />
        </div>
      </div>
    </aside>
  );
}
