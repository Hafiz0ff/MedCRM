import { localDb, CachedAppointment, OutboxItem } from './database';

type SyncProgressCallback = (
  status: 'idle' | 'syncing' | 'success' | 'error',
  details?: string,
) => void;

class OfflineSyncEngine {
  private isOnline = true;
  private syncInProgress = false;
  private progressListeners = new Set<SyncProgressCallback>();
  private connectionListeners = new Set<(online: boolean) => void>();

  constructor() {
    // Poll sync status occasionally
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncQueue();
      }
    }, 15000);
  }

  // Connection State Management
  public getConnectivity(): boolean {
    return this.isOnline;
  }

  public setConnectivity(online: boolean) {
    if (this.isOnline !== online) {
      this.isOnline = online;
      console.log(`[SyncEngine] Connectivity state changed to: ${online ? 'ONLINE' : 'OFFLINE'}`);

      // Trigger listener calls
      this.connectionListeners.forEach((listener) => listener(online));

      if (online) {
        // Trigger auto reconciliation upon reconnecting
        this.syncQueue();
      }
    }
  }

  public subscribeToConnection(callback: (online: boolean) => void) {
    this.connectionListeners.add(callback);
    return () => this.connectionListeners.delete(callback);
  }

  public subscribeToProgress(callback: SyncProgressCallback) {
    this.progressListeners.add(callback);
    return () => this.progressListeners.delete(callback);
  }

  private notifyProgress(status: 'idle' | 'syncing' | 'success' | 'error', details?: string) {
    this.progressListeners.forEach((cb) => cb(status, details));
  }

  // Cache actions: Caches daily doctor schedules
  public async refreshDailySchedulesFromServer(): Promise<CachedAppointment[]> {
    if (!this.isOnline) {
      console.log('[SyncEngine] Offline: Loading schedules from local SQLite cache.');
      this.notifyProgress('error', 'Автономный режим. Загружено локальное расписание.');
      return await localDb.getCachedSchedules();
    }

    this.notifyProgress('syncing', 'Синхронизируем расписание с сервером...');

    try {
      // Simulate API query to `/emr/appointments/daily`
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const remoteSchedules: CachedAppointment[] = [
        {
          id: 'a-101',
          patientName: 'Раджабов Бахтиер',
          patientCode: 'PAT-8809',
          startAt: '09:00',
          endAt: '09:45',
          notes: 'Плановый осмотр, подозрение на аритмию',
          status: 'confirmed',
        },
        {
          id: 'a-102',
          patientName: 'Каримова Гулноза',
          patientCode: 'PAT-4211',
          startAt: '10:30',
          endAt: '11:15',
          notes: 'Контрольный визит после терапии, гипертония',
          status: 'confirmed',
        },
        {
          id: 'a-103',
          patientName: 'Солиев Фирдавс',
          patientCode: 'PAT-7601',
          startAt: '13:00',
          endAt: '13:45',
          notes: 'Жалобы на одышку, первичная консультация',
          status: 'confirmed',
        },
        {
          id: 'a-104',
          patientName: 'Юсупова Манижа',
          patientCode: 'PAT-2993',
          startAt: '15:00',
          endAt: '15:45',
          notes: 'Консультация по результатам холтера',
          status: 'confirmed',
        },
      ];

      // Save locally to SQLite
      await localDb.cacheSchedules(remoteSchedules);
      this.notifyProgress('success', 'Локальный кэш расписания успешно обновлен.');
      return remoteSchedules;
    } catch (e) {
      console.error('[SyncEngine] Cache refresh failure', e);
      this.notifyProgress('error', 'Ошибка обновления кэша. Загружены локальные данные.');
      return await localDb.getCachedSchedules();
    }
  }

  // Queue Offline encounters/vitals
  public async recordOfflineEncounter(
    appointmentId: string,
    patientCode: string,
    vitals: OutboxItem['vitals'],
    clinicNotes: string,
  ): Promise<string> {
    const localId = `enc-local-${Date.now()}-${Math.random().toString().slice(-4)}`;

    await localDb.queueOfflineEncounter({
      id: localId,
      appointmentId,
      patientCode,
      vitals,
      clinicNotes,
      createdAt: new Date().toISOString(),
    });

    console.log(`[SyncEngine] Encounter queued locally: ${localId}`);

    if (this.isOnline) {
      // Trigger background sync cycle
      this.syncQueue();
    } else {
      this.notifyProgress('idle', 'Запись сохранена в оффлайн-очередь (Outbox).');
    }

    return localId;
  }

  // Replication Merger loop
  public async syncQueue(): Promise<void> {
    if (this.syncInProgress) return;
    if (!this.isOnline) return;

    const pending = await localDb.getPendingOutbox();
    if (pending.length === 0) {
      this.notifyProgress('idle');
      return;
    }

    this.syncInProgress = true;
    this.notifyProgress(
      'syncing',
      `Синхронизация очереди: отправляем ${pending.length} записей...`,
    );
    console.log(
      `[SyncEngine] Replicating ${pending.length} items from outbox to backend MedCRM...`,
    );

    try {
      for (const item of pending) {
        // Simulated REST payload replication to `/emr/encounter/sync`
        await new Promise((resolve) => setTimeout(resolve, 800));

        console.log(
          `[SyncEngine] Successfully synced encounter ${item.id} (Appointment: ${item.appointmentId})`,
        );
        await localDb.markAsSynced(item.id);
      }

      // Cleanup successful logs
      await localDb.clearSynced();

      this.notifyProgress('success', 'Все оффлайн-записи успешно синхронизированы!');
    } catch (e: any) {
      console.error('[SyncEngine] Queue replication aborted due to error', e);
      this.notifyProgress('error', `Ошибка отправки очереди: ${e.message || 'Сбой соединения'}`);
    } finally {
      this.syncInProgress = false;
    }
  }
}

export const syncEngine = new OfflineSyncEngine();
