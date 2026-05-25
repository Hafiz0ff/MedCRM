'use client';

import { useWeekAppointments } from '../hooks/use-scheduling';
import { formatVisitTime, statusLabel, statusTone } from '@/shared/ui/status';
import type { BootstrapPayload } from '@/shared/types/bootstrap';
import { Clock3 } from 'lucide-react';

interface WeekViewProps {
  bootstrap: BootstrapPayload;
  selectedDate: Date;
  branchId: string;
}

export function WeekView({ bootstrap, selectedDate, branchId }: WeekViewProps) {
  const weekAppointments = useWeekAppointments(branchId, selectedDate);

  // Generate 7 days starting from the Monday of the selectedDate's week
  const getWeekDates = () => {
    const dates = [];
    const base = new Date(selectedDate);
    const day = base.getDay();
    const diff = base.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(base.setDate(diff));

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  const getAppointmentsForDay = (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return weekAppointments.data?.items.filter(app => {
      const appDate = new Date(app.startAt);
      return appDate >= start && appDate < end;
    }) ?? [];
  };

  const getDayName = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="week-grid-container">
      {weekAppointments.isLoading ? (
        <p className="muted">Загрузка расписания на неделю...</p>
      ) : (
        <div className="week-columns">
          {weekDates.map((date, idx) => {
            const dayApps = getAppointmentsForDay(date);
            const isToday = new Date().toDateString() === date.toDateString();

            return (
              <div key={idx} className={`week-column ${isToday ? 'today' : ''}`}>
                <div className="week-column-header">
                  <strong>{getDayName(date)}</strong>
                  {isToday ? <span className="today-badge">Сегодня</span> : null}
                </div>
                <div className="week-column-body">
                  {dayApps.length ? (
                    dayApps.map((app) => {
                      const emp = app.employee;
                      const docName = emp ? `${emp.lastName} ${emp.firstName.slice(0, 1)}.` : 'Врач';

                      return (
                        <div key={app.id} className="week-app-card">
                          <div className="week-app-time">
                            <Clock3 size={12} />
                            <span>{formatVisitTime(app.startAt)}</span>
                          </div>
                          <strong className="week-app-patient">{app.patient.fullName}</strong>
                          <span className="week-app-service">{app.service?.name ?? 'Без услуги'}</span>
                          <span className="week-app-doc">{docName}</span>
                          <span className={`status-badge status-${statusTone(app.status)}`}>
                            {statusLabel(app.status)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="week-empty-slot">
                      <span>Нет записей</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
