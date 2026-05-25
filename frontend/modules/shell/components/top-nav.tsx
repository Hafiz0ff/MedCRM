'use client';

import {
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Stethoscope,
  UserRoundCheck,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import { can, moduleEnabled } from '@/shared/permissions/can';
import { BootstrapPayload } from '@/shared/types/bootstrap';

type NavItem = {
  href: string;
  label: string;
  module: string;
  permission: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

const primaryNav: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Операционная',
    module: 'auth',
    permission: 'auth.bootstrap.read',
    icon: LayoutDashboard,
  },
  {
    href: '/reception',
    label: 'Живая очередь',
    module: 'receptionist-workplace',
    permission: 'reception.dashboard.read',
    icon: ClipboardList,
  },
  {
    href: '/schedule',
    label: 'Расписание',
    module: 'smart-scheduling',
    permission: 'scheduling.calendar.read',
    icon: CalendarDays,
  },
  {
    href: '/patients',
    label: 'Пациенты',
    module: 'patient-crm',
    permission: 'patients.read',
    icon: Users,
  },
  {
    href: '/doctors',
    label: 'Врачи',
    module: 'auth',
    permission: 'auth.bootstrap.read',
    icon: UserRoundCheck,
  },
  {
    href: '/finance',
    label: 'Финансы',
    module: 'finance-billing',
    permission: 'finance.invoice.read',
    icon: WalletCards,
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const items = primaryNav.filter(
    (item) => moduleEnabled(bootstrap, item.module) && can(bootstrap, item.permission),
  );
  const hasSettings = can(bootstrap, 'system.settings.read');

  return (
    <header className="topnav" aria-label="Главная навигация">
      <div className="topnav-inner">
        <div className="topnav-brand">
          <Link href="/dashboard" className="brand-link" aria-label={bootstrap.tenant.name}>
            <span className="brand-mark brand-mark-md">
              <Stethoscope size={18} strokeWidth={2.1} />
            </span>
            <span className="brand-text">
              <strong>{bootstrap.tenant.name}</strong>
              <span className="brand-sub">{bootstrap.tenant.subscriptionPlan}</span>
            </span>
          </Link>
        </div>

        <nav className="topnav-links" aria-label="Разделы">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`topnav-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={16} strokeWidth={2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <span className="topnav-divider" aria-hidden="true" />
          <Link
            href="/dashboard"
            className="topnav-link is-muted"
            aria-disabled="true"
            tabIndex={-1}
          >
            <FileText size={16} strokeWidth={2} />
            <span>Отчёты</span>
          </Link>
          {hasSettings ? (
            <Link
              href="/settings"
              className={`topnav-link${isActive(pathname, '/settings') ? ' is-active' : ''}`}
              aria-current={isActive(pathname, '/settings') ? 'page' : undefined}
            >
              <Settings size={16} strokeWidth={2} />
              <span>Настройки</span>
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="topnav-link is-muted"
              aria-disabled="true"
              tabIndex={-1}
            >
              <Settings size={16} strokeWidth={2} />
              <span>Настройки</span>
            </Link>
          )}
        </nav>

        <button
          type="button"
          className="topnav-toggle"
          aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open ? (
        <div className="topnav-drawer" role="dialog" aria-modal="true" aria-label="Меню">
          <div className="topnav-drawer-section">
            <span className="topnav-section-label">Разделы</span>
            <div className="topnav-drawer-links">
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`topnav-drawer-link${active ? ' is-active' : ''}`}
                  >
                    <Icon size={18} strokeWidth={2} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {hasSettings ? (
                <Link
                  href="/settings"
                  className={`topnav-drawer-link${isActive(pathname, '/settings') ? ' is-active' : ''}`}
                >
                  <Settings size={18} strokeWidth={2} />
                  <span>Настройки</span>
                </Link>
              ) : null}
            </div>
          </div>
          <div className="topnav-drawer-section">
            <div className="topnav-drawer-user">
              <span className="topnav-drawer-avatar">АД</span>
              <div>
                <strong>Администратор</strong>
                <span>
                  {bootstrap.enabledModules.length} модулей · {bootstrap.permissions.length} прав
                </span>
              </div>
              <LogOut size={16} className="muted" />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
