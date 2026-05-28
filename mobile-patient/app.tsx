import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  Modal,
} from 'react-native';

// Type definitions for Patient Mobile Portal
interface Appointment {
  id: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  status: 'upcoming' | 'completed' | 'cancelled';
}

interface DocumentFile {
  id: string;
  title: string;
  date: string;
  type: 'PDF' | 'DICOM' | 'LAB';
  size: string;
}

export default function App() {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Tab Navigation state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking' | 'documents'>('dashboard');

  // Interactive booking selection state
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('Кардиология');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('2026-06-01');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [appointments, setAppointments] = useState<Appointment[]>([
    {
      id: '1',
      doctorName: 'Д-р Рахимов С. А.',
      specialty: 'Кардиология',
      date: '2026-06-02',
      time: '14:30',
      status: 'upcoming',
    },
    {
      id: '2',
      doctorName: 'Д-р Хамидова М. Б.',
      specialty: 'Терапия',
      date: '2026-05-20',
      time: '10:00',
      status: 'completed',
    },
  ]);

  // Document files list state
  const [documents, setDocuments] = useState<DocumentFile[]>([
    { id: 'd1', title: 'Анализ крови общий.pdf', date: '2026-05-18', type: 'LAB', size: '1.2 MB' },
    {
      id: 'd2',
      title: 'ЭКГ Снимок сердца.dcm',
      date: '2026-05-15',
      type: 'DICOM',
      size: '18.4 MB',
    },
    {
      id: 'd3',
      title: 'Справка для госпитализации.pdf',
      date: '2026-05-10',
      type: 'PDF',
      size: '640 KB',
    },
  ]);

  // Telehealth virtual visualizer modal state
  const [telehealthVisible, setTelehealthVisible] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

  // Notification lists simulator
  const [notifications, setNotifications] = useState<string[]>([
    'Напоминание: у вас запланирован визит к Кардиологу завтра в 14:30.',
    'Ваш общий анализ крови готов. Ознакомьтесь в разделе Документы.',
  ]);

  // OTP handlers
  const handleRequestOtp = () => {
    if (!phoneNumber || phoneNumber.length < 9) {
      Alert.alert('Ошибка', 'Пожалуйста, введите корректный номер телефона.');
      return;
    }
    setAuthLoading(true);
    setTimeout(() => {
      setAuthLoading(false);
      setOtpSent(true);
      Alert.alert('SMS Отправлено', 'Тестовый код подтверждения: 7777');
    }, 800);
  };

  const handleVerifyOtp = () => {
    if (otpCode !== '7777') {
      Alert.alert('Ошибка', 'Неверный код OTP. Введите 7777 для теста.');
      return;
    }
    setAuthLoading(true);
    setTimeout(() => {
      setAuthLoading(false);
      setIsLoggedIn(true);
    }, 800);
  };

  // Mock booking confirmation
  const handleConfirmBooking = () => {
    if (!selectedDoctor || !selectedTime) {
      Alert.alert('Заполните данные', 'Пожалуйста, выберите врача и свободное время.');
      return;
    }

    const newApp: Appointment = {
      id: String(appointments.length + 1),
      doctorName: selectedDoctor,
      specialty: selectedSpecialty,
      date: selectedDate,
      time: selectedTime,
      status: 'upcoming',
    };

    setAppointments([newApp, ...appointments]);
    Alert.alert(
      'Успешно забронировано!',
      `Запись к ${selectedDoctor} на ${selectedDate} в ${selectedTime} подтверждена.`,
    );
    setActiveTab('dashboard');
    setSelectedDoctor('');
    setSelectedTime('');

    // Send push notification locally
    setNotifications((prev) => [
      `Запись к врачу ${selectedDoctor} успешно забронирована на ${selectedDate} в ${selectedTime}.`,
      ...prev,
    ]);
  };

  // Simulated document uploading
  const handleUploadDocument = () => {
    Alert.alert(
      'Загрузка документа',
      'Выберите тип файла для импорта',
      [
        {
          text: 'PDF Результат анализа',
          onPress: () => {
            const newDoc: DocumentFile = {
              id: `d${documents.length + 1}`,
              title: `Импорт-Анализ-${Date.now().toString().slice(-4)}.pdf`,
              date: new Date().toISOString().slice(0, 10),
              type: 'LAB',
              size: '420 KB',
            };
            setDocuments([newDoc, ...documents]);
            Alert.alert(
              'Документ сохранен',
              'Файл успешно загружен в ваше защищенное облако MedCRM.',
            );
          },
        },
        {
          text: 'DICOM Снимок исследования',
          onPress: () => {
            const newDoc: DocumentFile = {
              id: `d${documents.length + 1}`,
              title: `DICOM-KT-${Date.now().toString().slice(-4)}.dcm`,
              date: new Date().toISOString().slice(0, 10),
              type: 'DICOM',
              size: '24.5 MB',
            };
            setDocuments([newDoc, ...documents]);
            Alert.alert(
              'DICOM Файл сохранен',
              'Медицинские снимки добавлены для авто-синхронизации.',
            );
          },
        },
        { text: 'Отмена', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  // Mock critical notifications generator
  const triggerMockNotification = () => {
    const alerts = [
      'Внимание: Ваш врач Д-р Рахимов С. А. ожидает вас в онлайн-кабинете для телемедицинской консультации!',
      'Критическое обновление: Изменились часы приема вашего терапевта.',
      'Напоминание о здоровье: Рекомендуется внести сегодняшние показатели пульса и давления.',
    ];
    const selected = alerts[Math.floor(Math.random() * alerts.length)];
    setNotifications((prev) => [selected, ...prev]);
    Alert.alert('Push-уведомление', selected);
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.authBox}>
          <Text style={styles.authHeader}>MedCRM Mobile</Text>
          <Text style={styles.authSub}>Панель управления здоровьем пациента</Text>

          <View style={styles.glassCard}>
            <Text style={styles.cardTitle}>
              {otpSent ? 'Подтверждение' : 'Авторизация пациента'}
            </Text>
            <Text style={styles.cardDesc}>
              {otpSent
                ? 'Мы отправили код подтверждения на ваш мобильный телефон.'
                : 'Введите ваш номер мобильного телефона для входа по одноразовому OTP.'}
            </Text>

            {!otpSent ? (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Номер телефона</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+992 900 00 0000"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                />
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleRequestOtp}
                  disabled={authLoading}
                >
                  <Text style={styles.buttonText}>
                    {authLoading ? 'Отправка...' : 'Получить СМС Код'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Код из СМС (тест: 7777)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0000"
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  maxLength={4}
                />
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleVerifyOtp}
                  disabled={authLoading}
                >
                  <Text style={styles.buttonText}>
                    {authLoading ? 'Проверка...' : 'Войти в личный кабинет'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setOtpSent(false)}>
                  <Text style={styles.secondaryButtonText}>Изменить номер</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* HEADER BAR */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Здравствуйте,</Text>
          <Text style={styles.patientName}>Алишер Собиров</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn} onPress={triggerMockNotification}>
          <Text style={styles.bellIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* DYNAMIC TELEHEALTH TRIGGER FLOATING BOX */}
      <View style={styles.telehealthFloating}>
        <View style={styles.telehealthInner}>
          <View style={styles.telehealthDotContainer}>
            <View style={styles.telehealthPulse} />
            <Text style={styles.telehealthLiveText}>Консультация активна</Text>
          </View>
          <TouchableOpacity
            style={styles.telehealthEnterBtn}
            onPress={() => setTelehealthVisible(true)}
          >
            <Text style={styles.telehealthEnterText}>Войти в кабинет 🎥</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN VIEW */}
      <ScrollView style={styles.mainScroll} contentContainerStyle={{ paddingBottom: 100 }}>
        {activeTab === 'dashboard' && (
          <View style={styles.tabContent}>
            {/* Dashboard Quick stats */}
            <View style={styles.statsRow}>
              <View style={[styles.statBox, styles.glassBg]}>
                <Text style={styles.statLabel}>Группа крови</Text>
                <Text style={styles.statValue}>A (II) Rh+</Text>
              </View>
              <View style={[styles.statBox, styles.glassBg]}>
                <Text style={styles.statLabel}>Аллергии</Text>
                <Text style={[styles.statValue, { color: '#ef4444' }]}>Пенициллин</Text>
              </View>
            </View>

            {/* Upcoming Appointments Widget */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ближайшие приемы</Text>
              <TouchableOpacity onPress={() => setActiveTab('booking')}>
                <Text style={styles.sectionLink}>Записаться</Text>
              </TouchableOpacity>
            </View>

            {appointments
              .filter((a) => a.status === 'upcoming')
              .map((app) => (
                <View key={app.id} style={[styles.appointmentCard, styles.glassBg]}>
                  <View style={styles.appCardHeader}>
                    <Text style={styles.appDoctor}>{app.doctorName}</Text>
                    <Text style={styles.appSpecialty}>{app.specialty}</Text>
                  </View>
                  <View style={styles.appCardFooter}>
                    <Text style={styles.appDateTime}>
                      📅 {app.date} в {app.time}
                    </Text>
                    <TouchableOpacity
                      style={styles.videoLinkBtn}
                      onPress={() => setTelehealthVisible(true)}
                    >
                      <Text style={styles.videoLinkText}>Телемед</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

            {/* Active System Notifications Feed */}
            <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>
              Уведомления и рекомендации
            </Text>
            <View style={styles.notificationsContainer}>
              {notifications.map((note, idx) => (
                <View key={idx} style={[styles.noteCard, styles.glassBg]}>
                  <Text style={styles.noteIndicator}>•</Text>
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))}
            </View>

            {/* Logout button */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                setIsLoggedIn(false);
                setOtpSent(false);
                setOtpCode('');
              }}
            >
              <Text style={styles.logoutBtnText}>Выйти из аккаунта</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'booking' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Новая запись к врачу</Text>
            <Text style={styles.sectionDesc}>
              Выберите клиническую специализацию, свободного доктора и удобный слот.
            </Text>

            {/* Specialty picker mock */}
            <Text style={styles.fieldLabel}>Специализация врача</Text>
            <View style={styles.pickerRow}>
              {['Кардиология', 'Терапия', 'Офтальмология', 'Неврология'].map((spec) => (
                <TouchableOpacity
                  key={spec}
                  style={[styles.pickerChip, selectedSpecialty === spec && styles.pickerChipActive]}
                  onPress={() => {
                    setSelectedSpecialty(spec);
                    setSelectedDoctor('');
                  }}
                >
                  <Text
                    style={[
                      styles.pickerChipText,
                      selectedSpecialty === spec && styles.pickerChipTextActive,
                    ]}
                  >
                    {spec}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Doctor Picker Mock */}
            <Text style={styles.fieldLabel}>Врач-специалист</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
              {[
                { name: 'Д-р Рахимов С. А.', spec: 'Кардиология', rating: '⭐️ 4.9' },
                { name: 'Д-р Махмудов К. Т.', spec: 'Кардиология', rating: '⭐️ 4.8' },
                { name: 'Д-р Хамидова М. Б.', spec: 'Терапия', rating: '⭐️ 5.0' },
                { name: 'Д-р Назарова З. И.', spec: 'Неврология', rating: '⭐️ 4.7' },
              ]
                .filter((d) => d.spec === selectedSpecialty)
                .map((doc) => (
                  <TouchableOpacity
                    key={doc.name}
                    style={[
                      styles.docSelectionCard,
                      selectedDoctor === doc.name && styles.docSelectionCardActive,
                    ]}
                    onPress={() => setSelectedDoctor(doc.name)}
                  >
                    <Text style={styles.docSelName}>{doc.name}</Text>
                    <Text style={styles.docSelRating}>{doc.rating}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Date Pickers */}
            <Text style={styles.fieldLabel}>Дата приема</Text>
            <View style={styles.pickerRow}>
              {['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'].map((date) => (
                <TouchableOpacity
                  key={date}
                  style={[styles.pickerChip, selectedDate === date && styles.pickerChipActive]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text
                    style={[
                      styles.pickerChipText,
                      selectedDate === date && styles.pickerChipTextActive,
                    ]}
                  >
                    {date.slice(5)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Slots selector */}
            <Text style={styles.fieldLabel}>Доступное время</Text>
            <View style={styles.slotsGrid}>
              {['09:00', '10:30', '11:00', '13:00', '14:30', '16:00'].map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[styles.slotCard, selectedTime === time && styles.slotCardActive]}
                  onPress={() => setSelectedTime(time)}
                >
                  <Text
                    style={[
                      styles.slotCardText,
                      selectedTime === time && styles.slotCardTextActive,
                    ]}
                  >
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Book button */}
            <TouchableOpacity style={styles.bookConfirmBtn} onPress={handleConfirmBooking}>
              <Text style={styles.bookConfirmText}>Завершить бронирование</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'documents' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Медицинская карта</Text>
              <TouchableOpacity style={styles.addDocBtn} onPress={handleUploadDocument}>
                <Text style={styles.addDocText}>+ Загрузить</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionDesc}>
              Все врачебные выписки, результаты общих анализов и рентгеновские DICOM-снимки.
            </Text>

            {/* Documents Cabinet list */}
            <View style={styles.documentsContainer}>
              {documents.map((doc) => (
                <View key={doc.id} style={[styles.documentCard, styles.glassBg]}>
                  <View style={styles.docMetaLeft}>
                    <Text style={styles.docIcon}>
                      {doc.type === 'DICOM' ? '🎞️' : doc.type === 'LAB' ? '🩸' : '📄'}
                    </Text>
                    <View>
                      <Text style={styles.docTitle}>{doc.title}</Text>
                      <Text style={styles.docSubtitle}>
                        {doc.date} • {doc.size}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.viewDocBtn}
                    onPress={() => {
                      if (doc.type === 'DICOM') {
                        Alert.alert(
                          'Медицинский DICOM Вьюер',
                          'Запуск локального рендерера срезов КТ/МРТ в 3D режиме сжатия.',
                        );
                      } else {
                        Alert.alert(
                          'Просмотр документа',
                          `Открытие ${doc.title} во встроенном защищенном PDF-ридере.`,
                        );
                      }
                    }}
                  >
                    <Text style={styles.viewDocText}>
                      {doc.type === 'DICOM' ? '3D Срез' : 'Открыть'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* TELEHEALTH VIDEO CONFERENCING SIMULATOR MODAL */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={telehealthVisible}
        onRequestClose={() => setTelehealthVisible(false)}
      >
        <View style={styles.telehealthModal}>
          {/* Main camera backdrop mock */}
          <View style={styles.doctorVideoFrame}>
            <View style={styles.modalOverlayHeader}>
              <Text style={styles.modalOverlayTitle}>Защищенный телемед MedCRM</Text>
              <Text style={styles.modalOverlaySub}>Д-р Рахимов С. А. (Кардиолог)</Text>
            </View>
            <View style={styles.docFeedMock}>
              <Text style={styles.feedStatusLabel}>ВРАЧ: ВИДЕОСВЯЗЬ АКТИВНА (1080p HD)</Text>
              <Text style={styles.feedSmile}>👨‍⚕️</Text>
            </View>
          </View>

          {/* Local camera preview */}
          <View style={styles.patientVideoFrame}>
            <Text style={styles.patientFeedLabel}>Вы</Text>
            <Text style={styles.patientSmile}>👤</Text>
          </View>

          {/* Controls overlay */}
          <View style={styles.modalControlsRow}>
            <TouchableOpacity
              style={[styles.modalControlCircle, audioMuted && styles.controlMuted]}
              onPress={() => setAudioMuted(!audioMuted)}
            >
              <Text style={styles.controlIconText}>{audioMuted ? '🎙️❌' : '🎙️'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalControlCircle, videoMuted && styles.controlMuted]}
              onPress={() => setVideoMuted(!videoMuted)}
            >
              <Text style={styles.controlIconText}>{videoMuted ? '🎥❌' : '🎥'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalControlCircle, styles.controlEndCall]}
              onPress={() => {
                setTelehealthVisible(false);
                Alert.alert(
                  'Сессия завершена',
                  'Визит завершен. Клиническое заключение будет доступно в вашей медкарте.',
                );
              }}
            >
              <Text style={styles.controlIconText}>📞</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* BOTTOM TAB NAVIGATION */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>
            Главная
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'booking' && styles.navItemActive]}
          onPress={() => setActiveTab('booking')}
        >
          <Text style={styles.navIcon}>📅</Text>
          <Text style={[styles.navText, activeTab === 'booking' && styles.navTextActive]}>
            Запись
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'documents' && styles.navItemActive]}
          onPress={() => setActiveTab('documents')}
        >
          <Text style={styles.navIcon}>📁</Text>
          <Text style={[styles.navText, activeTab === 'documents' && styles.navTextActive]}>
            Медкарта
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authBox: {
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  authHeader: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 6,
    fontFamily: 'System',
  },
  authSub: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 30,
    textAlign: 'center',
  },
  glassCard: {
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 20,
  },
  inputContainer: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    height: 48,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    color: '#f8fafc',
    fontSize: 16,
    marginBottom: 16,
  },
  primaryButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    textDecorationLine: 'underline',
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
  greeting: {
    color: '#94a3b8',
    fontSize: 12,
  },
  patientName: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellIcon: {
    fontSize: 16,
  },
  telehealthFloating: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  telehealthInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    padding: 12,
  },
  telehealthDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  telehealthPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 8,
  },
  telehealthLiveText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  telehealthEnterBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  telehealthEnterText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  mainScroll: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  tabContent: {
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  glassBg: {
    backgroundColor: 'rgba(30, 41, 59, 0.25)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  sectionDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 16,
  },
  sectionLink: {
    color: '#3b82f6',
    fontSize: 13,
  },
  appointmentCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  appCardHeader: {
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 10,
    marginBottom: 10,
  },
  appDoctor: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  appSpecialty: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 2,
  },
  appCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appDateTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  videoLinkBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  videoLinkText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  notificationsContainer: {
    gap: 8,
  },
  noteCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
  },
  noteIndicator: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  noteText: {
    color: '#cbd5e1',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  logoutBtn: {
    width: '100%',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
    marginTop: 32,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: 'bold',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginTop: 16,
    marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  pickerChipActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  pickerChipText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  pickerChipTextActive: {
    color: '#f8fafc',
    fontWeight: 'bold',
  },
  horizontalScroll: {
    flexDirection: 'row',
    gap: 12,
  },
  docSelectionCard: {
    width: 140,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 10,
  },
  docSelectionCardActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  docSelName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
  },
  docSelRating: {
    fontSize: 10,
    color: '#e2e8f0',
    marginTop: 6,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slotCard: {
    width: '30%',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  slotCardActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  slotCardText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  slotCardTextActive: {
    color: '#f8fafc',
  },
  bookConfirmBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  bookConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addDocBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  addDocText: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: 'bold',
  },
  documentsContainer: {
    gap: 10,
  },
  documentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
  },
  docMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  docIcon: {
    fontSize: 22,
  },
  docTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  docSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  viewDocBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  viewDocText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  telehealthModal: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'space-between',
  },
  doctorVideoFrame: {
    flex: 1,
    backgroundColor: '#18181b',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlayHeader: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  modalOverlayTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlaySub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  docFeedMock: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedStatusLabel: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 10,
  },
  feedSmile: {
    fontSize: 72,
  },
  patientVideoFrame: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 110,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#27272a',
    borderWidth: 2,
    borderColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  patientFeedLabel: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  patientSmile: {
    fontSize: 32,
  },
  modalControlsRow: {
    height: 100,
    backgroundColor: '#09090b',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    borderTopWidth: 1,
    borderColor: '#27272a',
  },
  modalControlCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlMuted: {
    backgroundColor: '#ef4444',
  },
  controlEndCall: {
    backgroundColor: '#ef4444',
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  controlIconText: {
    fontSize: 18,
    color: '#ffffff',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#09090b',
    borderTopWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 10,
  },
  navItem: {
    alignItems: 'center',
  },
  navItemActive: {
    borderTopWidth: 2,
    borderColor: '#3b82f6',
    paddingTop: 4,
  },
  navIcon: {
    fontSize: 20,
  },
  navText: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  navTextActive: {
    color: '#f8fafc',
    fontWeight: 'bold',
  },
});
