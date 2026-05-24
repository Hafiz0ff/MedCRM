export const appointmentStatusMeta: Record<string, { label: string; tone: string }> = {
  SCHEDULED: { label: 'Запланирован', tone: 'neutral' },
  CONFIRMED: { label: 'Подтвержден', tone: 'info' },
  CHECKED_IN: { label: 'Пришел', tone: 'warning' },
  IN_PROGRESS: { label: 'На приеме', tone: 'violet' },
  COMPLETED: { label: 'Завершен', tone: 'success' },
  COMPLETED_PENDING_PAYMENT: { label: 'К оплате', tone: 'warning' },
  CANCELLED: { label: 'Отменен', tone: 'danger' },
  NO_SHOW: { label: 'Не пришел', tone: 'danger' },
  RESCHEDULED: { label: 'Перенесен', tone: 'neutral' }
};

export const patientStatusMeta: Record<string, { label: string; tone: string }> = {
  NEW: { label: 'Новый', tone: 'info' },
  ACTIVE: { label: 'Активный', tone: 'success' },
  SLEEPING: { label: 'Спящий', tone: 'warning' },
  VIP: { label: 'VIP', tone: 'violet' },
  BLOCKED: { label: 'Ограничен', tone: 'danger' },
  ARCHIVED: { label: 'Архив', tone: 'neutral' }
};

export function statusLabel(status: string, type: 'appointment' | 'patient' = 'appointment') {
  const source = type === 'patient' ? patientStatusMeta : appointmentStatusMeta;
  return source[status]?.label ?? status;
}

export function statusTone(status: string, type: 'appointment' | 'patient' = 'appointment') {
  const source = type === 'patient' ? patientStatusMeta : appointmentStatusMeta;
  return source[status]?.tone ?? 'neutral';
}

export function formatVisitTime(value: string) {
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value: Date) {
  return value.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'long'
  });
}
