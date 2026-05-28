import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export interface CachedAppointment {
  id: string;
  patientName: string;
  patientCode: string;
  startAt: string;
  endAt: string;
  notes?: string;
  status: string;
}

export interface OutboxItem {
  id: string;
  appointmentId: string;
  patientCode: string;
  vitals: {
    bloodPressure: string;
    pulse: number;
    temperature: number;
    spo2: number;
  };
  clinicNotes: string;
  createdAt: string;
  synced: number; // 0 = pending, 1 = synced, -1 = error
}

// Resilient database adapter supporting SQLite (Native Devices) and In-Memory fallback (Web / Test)
class LocalDbService {
  private db: any = null;
  private memoryCache: {
    schedule: Record<string, CachedAppointment>;
    outbox: Record<string, OutboxItem>;
  } = {
    schedule: {},
    outbox: {},
  };

  constructor() {
    this.initDb();
  }

  private async initDb() {
    if (Platform.OS === 'web') {
      console.warn(
        'MedCRM Doctor: Running in Web mode. SQLite is replaced with high-fidelity in-memory storage.',
      );
      return;
    }

    try {
      this.db = SQLite.openDatabaseSync('medcrm_doctor_local.db');

      // Initialize daily doctor schedules table
      this.db.execSync(`
        CREATE TABLE IF NOT EXISTS schedule (
          id TEXT PRIMARY KEY,
          patient_name TEXT NOT NULL,
          patient_code TEXT NOT NULL,
          start_at TEXT NOT NULL,
          end_at TEXT NOT NULL,
          notes TEXT,
          status TEXT NOT NULL
        );
      `);

      // Initialize offline encounters queue table (Outbox)
      this.db.execSync(`
        CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY,
          appointment_id TEXT NOT NULL,
          patient_code TEXT NOT NULL,
          vitals_json TEXT NOT NULL,
          clinic_notes TEXT NOT NULL,
          created_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
      `);
      console.log('SQLite initialized successfully in Native SQLite storage.');
    } catch (error) {
      console.error(
        'Failed to initialize native SQLite storage, switching to Memory Adapter:',
        error,
      );
      this.db = null;
    }
  }

  // Caching/Schedule actions
  public async cacheSchedules(appointments: CachedAppointment[]): Promise<void> {
    if (!this.db) {
      // Memory cache save
      appointments.forEach((app) => {
        this.memoryCache.schedule[app.id] = app;
      });
      return;
    }

    try {
      // Clear old entries
      this.db.runSync('DELETE FROM schedule;');

      // Batch insert
      for (const app of appointments) {
        this.db.runSync(
          'INSERT INTO schedule (id, patient_name, patient_code, start_at, end_at, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?);',
          [
            app.id,
            app.patientName,
            app.patientCode,
            app.startAt,
            app.endAt,
            app.notes || '',
            app.status,
          ],
        );
      }
    } catch (e) {
      console.error('SQLite: failed to cache schedules', e);
    }
  }

  public async getCachedSchedules(): Promise<CachedAppointment[]> {
    if (!this.db) {
      return Object.values(this.memoryCache.schedule);
    }

    try {
      const rows = this.db.getAllSync('SELECT * FROM schedule ORDER BY start_at ASC;') as any[];
      return rows.map((r) => ({
        id: r.id,
        patientName: r.patient_name,
        patientCode: r.patient_code,
        startAt: r.start_at,
        endAt: r.end_at,
        notes: r.notes,
        status: r.status,
      }));
    } catch (e) {
      console.error('SQLite: failed to get cached schedules', e);
      return [];
    }
  }

  // Outbox Offline actions
  public async queueOfflineEncounter(item: Omit<OutboxItem, 'synced'>): Promise<void> {
    const fullItem: OutboxItem = { ...item, synced: 0 };

    if (!this.db) {
      this.memoryCache.outbox[fullItem.id] = fullItem;
      return;
    }

    try {
      this.db.runSync(
        'INSERT INTO outbox (id, appointment_id, patient_code, vitals_json, clinic_notes, created_at, synced) VALUES (?, ?, ?, ?, ?, ?, 0);',
        [
          fullItem.id,
          fullItem.appointmentId,
          fullItem.patientCode,
          JSON.stringify(fullItem.vitals),
          fullItem.clinicNotes,
          fullItem.createdAt,
        ],
      );
    } catch (e) {
      console.error('SQLite: failed to queue offline notes in outbox', e);
    }
  }

  public async getPendingOutbox(): Promise<OutboxItem[]> {
    if (!this.db) {
      return Object.values(this.memoryCache.outbox).filter((x) => x.synced === 0);
    }

    try {
      const rows = this.db.getAllSync(
        'SELECT * FROM outbox WHERE synced = 0 ORDER BY created_at ASC;',
      ) as any[];
      return rows.map((r) => ({
        id: r.id,
        appointmentId: r.appointment_id,
        patientCode: r.patient_code,
        vitals: JSON.parse(r.vitals_json),
        clinicNotes: r.clinic_notes,
        createdAt: r.created_at,
        synced: r.synced,
      }));
    } catch (e) {
      console.error('SQLite: failed to query outbox queue', e);
      return [];
    }
  }

  public async markAsSynced(id: string): Promise<void> {
    if (!this.db) {
      if (this.memoryCache.outbox[id]) {
        this.memoryCache.outbox[id].synced = 1;
      }
      return;
    }

    try {
      this.db.runSync('UPDATE outbox SET synced = 1 WHERE id = ?;', [id]);
    } catch (e) {
      console.error('SQLite: failed to update synced status', e);
    }
  }

  public async clearSynced(): Promise<void> {
    if (!this.db) {
      Object.keys(this.memoryCache.outbox).forEach((k) => {
        if (this.memoryCache.outbox[k].synced === 1) {
          delete this.memoryCache.outbox[k];
        }
      });
      return;
    }

    try {
      this.db.runSync('DELETE FROM outbox WHERE synced = 1;');
    } catch (e) {
      console.error('SQLite: failed to clear synced outbox history', e);
    }
  }
}

export const localDb = new LocalDbService();
