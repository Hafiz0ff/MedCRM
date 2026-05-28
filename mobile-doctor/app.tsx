import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { localDb, CachedAppointment, OutboxItem } from './database';
import { syncEngine } from './sync-engine';

export default function App() {
  // SQLite daily schedules cache state
  const [appointments, setAppointments] = useState<CachedAppointment[]>([]);
  const [activeAppointment, setActiveAppointment] = useState<CachedAppointment | null>(null);

  // Encounter form state
  const [bloodPressure, setBloodPressure] = useState('120/80');
  const [pulse, setPulse] = useState('72');
  const [temperature, setTemperature] = useState('36.6');
  const [spo2, setSpo2] = useState('98');
  const [clinicNotes, setClinicNotes] = useState('');

  // Sync / Connectivity States
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // Sync callbacks and observers setup
  useEffect(() => {
    // Initial fetch of daily schedules
    loadSchedules();
    updatePendingQueueStats();

    // Subscribe to Connectivity modifications
    const unsubConn = syncEngine.subscribeToConnection((online) => {
      setIsOnline(online);
      loadSchedules();
      updatePendingQueueStats();
    });

    // Subscribe to sync engine status
    const unsubProgress = syncEngine.subscribeToProgress((status, msg) => {
      setSyncStatus(status);
      setSyncMessage(msg || '');
      updatePendingQueueStats();
      if (status === 'success' || status === 'error') {
        loadSchedules();
      }
    });

    return () => {
      unsubConn();
      unsubProgress();
    };
  }, []);

  // Refresh and query stats
  const loadSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const list = await syncEngine.refreshDailySchedulesFromServer();
      setAppointments(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const updatePendingQueueStats = async () => {
    try {
      const pending = await localDb.getPendingOutbox();
      setPendingCount(pending.length);
      setOutboxItems(pending);
    } catch (e) {
      console.error(e);
    }
  };

  // Switch connection mode manually
  const toggleConnectionMode = () => {
    const nextState = !isOnline;
    syncEngine.setConnectivity(nextState);
    Alert.alert(
      nextState ? 'Онлайн режим' : 'Оффлайн режим',
      nextState
        ? 'Связь с базой MedCRM восстановлена. Начинается авто-синхронизация очереди.'
        : 'Сеть отключена. Все клинические записи будут сохраняться в локальную базу SQLite.',
    );
  };

  // Submit recorded medical data
  const handleSubmitEncounter = async () => {
    if (!activeAppointment) {
      Alert.alert('Внимание', 'Пожалуйста, выберите пациента из списка расписания.');
      return;
    }

    if (!clinicNotes.trim()) {
      Alert.alert('Внимание', 'Клинический осмотр/жалобы не могут быть пустыми.');
      return;
    }

    const vitals = {
      bloodPressure: bloodPressure.trim(),
      pulse: parseInt(pulse) || 72,
      temperature: parseFloat(temperature) || 36.6,
      spo2: parseInt(spo2) || 98,
    };

    try {
      await syncEngine.recordOfflineEncounter(
        activeAppointment.id,
        activeAppointment.patientCode,
        vitals,
        clinicNotes.trim(),
      );

      Alert.alert(
        'Успешно сохранено',
        isOnline
          ? 'Клинический осмотр отправлен и успешно сохранен в медкарте пациента.'
          : 'Связь отсутствует. Запись сохранена в локальный сейв SQLite и будет синхронизирована при подключении.',
      );

      // Reset form states
      setBloodPressure('120/80');
      setPulse('72');
      setTemperature('36.6');
      setSpo2('98');
      setClinicNotes('');
      setActiveAppointment(null);

      // Reload stats
      updatePendingQueueStats();
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось сохранить встречу.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* HEADER SECTION */}
      <View style={styles.header}>
        <View>
          <Text style={styles.drTitle}>Врачебный Терминал</Text>
          <Text style={styles.drName}>Д-р Рахимов С. А. (Кардиолог)</Text>
        </View>

        {/* NETWORK SWITCH BUTTON */}
        <TouchableOpacity
          style={[styles.connBadge, isOnline ? styles.badgeOnline : styles.badgeOffline]}
          onPress={toggleConnectionMode}
        >
          <Text style={styles.badgeText}>{isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}</Text>
        </TouchableOpacity>
      </View>

      {/* SYNC ENGINE BANNER STATE */}
      {syncStatus !== 'idle' && (
        <View
          style={[
            styles.syncBanner,
            syncStatus === 'syncing'
              ? styles.syncingBanner
              : syncStatus === 'success'
                ? styles.syncSuccessBanner
                : styles.syncErrorBanner,
          ]}
        >
          {syncStatus === 'syncing' && (
            <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.syncBannerText}>
            {syncMessage || 'Идет процесс фоновой репликации...'}
          </Text>
        </View>
      )}

      <ScrollView style={styles.mainScroll} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* SCHEDULE SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Расписание на сегодня (SQLite кэш)</Text>
            <TouchableOpacity onPress={loadSchedules} disabled={loadingSchedules}>
              <Text style={styles.refreshLink}>
                {loadingSchedules ? 'Загрузка...' : '🔄 Обновить'}
              </Text>
            </TouchableOpacity>
          </View>

          {appointments.length === 0 ? (
            <View style={[styles.emptyCard, styles.glassBg]}>
              <Text style={styles.emptyText}>Нет сохраненных визитов на сегодня.</Text>
            </View>
          ) : (
            <View style={styles.scheduleList}>
              {appointments.map((app) => {
                const isActive = activeAppointment?.id === app.id;
                return (
                  <TouchableOpacity
                    key={app.id}
                    style={[
                      styles.appointmentCard,
                      styles.glassBg,
                      isActive && styles.activeAppointmentCard,
                    ]}
                    onPress={() => setActiveAppointment(app)}
                  >
                    <View style={styles.appHeader}>
                      <Text style={styles.patName}>{app.patientName}</Text>
                      <Text style={styles.appTime}>🕐 {app.startAt}</Text>
                    </View>
                    <Text style={styles.patCode}>ID Карты: {app.patientCode}</Text>
                    {app.notes ? (
                      <Text style={styles.patNotes}>Рекомендация: {app.notes}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* CLINICAL ENCOUNTER ENTRY FORM */}
        {activeAppointment ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Осмотр: <Text style={{ color: '#3b82f6' }}>{activeAppointment.patientName}</Text>
            </Text>

            <View style={[styles.glassCard, { marginTop: 12 }]}>
              {/* Vitals grids */}
              <Text style={styles.cardSectionLabel}>Фиксация жизненных показателей (Vitals)</Text>

              <View style={styles.vitalsRow}>
                <View style={styles.vitalField}>
                  <Text style={styles.fieldLabel}>Давление</Text>
                  <TextInput
                    style={styles.input}
                    value={bloodPressure}
                    onChangeText={setBloodPressure}
                    placeholder="120/80"
                    placeholderTextColor="#64748b"
                  />
                </View>

                <View style={styles.vitalField}>
                  <Text style={styles.fieldLabel}>Пульс (уд/м)</Text>
                  <TextInput
                    style={styles.input}
                    value={pulse}
                    onChangeText={setPulse}
                    keyboardType="number-pad"
                    placeholder="72"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <View style={styles.vitalsRow}>
                <View style={styles.vitalField}>
                  <Text style={styles.fieldLabel}>Темп. (°C)</Text>
                  <TextInput
                    style={styles.input}
                    value={temperature}
                    onChangeText={setTemperature}
                    keyboardType="decimal-pad"
                    placeholder="36.6"
                    placeholderTextColor="#64748b"
                  />
                </View>

                <View style={styles.vitalField}>
                  <Text style={styles.fieldLabel}>SpO2 (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={spo2}
                    onChangeText={setSpo2}
                    keyboardType="number-pad"
                    placeholder="98"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              {/* Clinic Notes */}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                Жалобы, осмотр, клинические заметки
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={clinicNotes}
                onChangeText={setClinicNotes}
                multiline
                numberOfLines={4}
                placeholder="Опишите состояние больного, аускультативные шумы, рекомендации лечения..."
                placeholderTextColor="#64748b"
              />

              {/* Save trigger */}
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitEncounter}>
                <Text style={styles.submitBtnText}>
                  {isOnline ? 'Сохранить и Отправить' : '💾 Сохранить в оффлайн очереди'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.placeholderForm, styles.glassBg]}>
            <Text style={styles.placeholderText}>
              Выберите пациента из списка выше для внесения жизненных показателей и клинического
              осмотра.
            </Text>
          </View>
        )}

        {/* OFFLINE OUTBOX QUEUE MONITOR */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Очередь оффлайн-отправок (Outbox)</Text>
            {pendingCount > 0 && isOnline && (
              <TouchableOpacity onPress={() => syncEngine.syncQueue()}>
                <Text style={styles.syncNowLink}>Синхронизировать сейчас</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.sectionDesc}>
            Здесь хранятся незавершенные клинические визиты, записанные во время отсутствия связи.
            При появлении интернета они выгружаются автоматически.
          </Text>

          {outboxItems.length === 0 ? (
            <View style={[styles.emptyCard, styles.glassBg]}>
              <Text style={styles.emptyText}>Очередь чиста. Все записи засинхронены.</Text>
            </View>
          ) : (
            <View style={styles.outboxList}>
              {outboxItems.map((item) => (
                <View key={item.id} style={[styles.outboxCard, styles.glassBg]}>
                  <View style={styles.outboxHeader}>
                    <Text style={styles.outboxPat}>Пациент: {item.patientCode}</Text>
                    <Text style={styles.outboxPendingText}>⏳ Ожидает</Text>
                  </View>
                  <Text style={styles.outboxMeta}>
                    Давление: {item.vitals.bloodPressure} | ЧСС: {item.vitals.pulse} уд/м | Темп:{' '}
                    {item.vitals.temperature}°C
                  </Text>
                  <Text style={styles.outboxNotes} numberOfLines={2}>
                    Заметки: {item.clinicNotes}
                  </Text>
                  <Text style={styles.outboxTime}>
                    Создано: {new Date(item.createdAt).toLocaleTimeString('ru-RU')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  drTitle: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  drName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  connBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  badgeOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  syncBanner: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncingBanner: {
    backgroundColor: '#3b82f6',
  },
  syncSuccessBanner: {
    backgroundColor: '#10b981',
  },
  syncErrorBanner: {
    backgroundColor: '#ef4444',
  },
  syncBannerText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  mainScroll: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  sectionDesc: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
    marginBottom: 12,
  },
  refreshLink: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  syncNowLink: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
  },
  glassBg: {
    backgroundColor: 'rgba(30, 41, 59, 0.25)',
  },
  scheduleList: {
    gap: 10,
  },
  appointmentCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
  },
  activeAppointmentCard: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  appTime: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  patCode: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
  },
  patNotes: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 8,
    fontStyle: 'italic',
  },
  placeholderForm: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  glassCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 20,
  },
  cardSectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  vitalField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    height: 40,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 12,
    color: '#f8fafc',
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingVertical: 10,
  },
  submitBtn: {
    width: '100%',
    height: 44,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  outboxList: {
    gap: 10,
  },
  outboxCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
  },
  outboxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  outboxPat: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  outboxPendingText: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  outboxMeta: {
    fontSize: 11,
    color: '#cbd5e1',
    lineHeight: 16,
  },
  outboxNotes: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  outboxTime: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'right',
  },
});
