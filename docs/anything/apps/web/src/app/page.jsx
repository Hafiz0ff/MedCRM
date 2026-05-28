"use client";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Layers,
  Stethoscope,
  FileText,
  Bell,
  Search,
  Plus,
  ChevronRight,
  Clock,
  CheckCircle,
  LogOut,
  Download,
  MoreHorizontal,
  HeartPulse,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertCircle,
  ChevronDown,
  Activity,
  Settings,
  RefreshCw,
} from "lucide-react";
import { patients, appointments, queue, doctors } from "@/data/clinic-data";

// ─── Design tokens ────────────────────────────────────────────────────────────
const NAV_BG = "#0D1117"; // almost-black header
const NAV_BORDER = "#1E2A36";
const ACCENT = "#38BDF8"; // sky-400 – crisp medical blue
const ACCENT_DIM = "#0EA5E9"; // sky-500
const GOLD = "#C9A96E"; // warm gold for premium touches
const BODY_BG = "#F5F6F8"; // warm off-white body
const CARD_BG = "#FFFFFF";
const TEXT1 = "#0F172A"; // slate-900
const TEXT2 = "#64748B"; // slate-500
const TEXT3 = "#94A3B8"; // slate-400
const BORDER = "#E8ECF0";

const STATUS_CFG = {
  Активный: { c: "#10B981", bg: "#ECFDF5" },
  Новый: { c: ACCENT_DIM, bg: "#F0F9FF" },
  "В архиве": { c: "#94A3B8", bg: "#F8FAFC" },
  Завершён: { c: "#10B981", bg: "#ECFDF5" },
  "В кабинете": { c: "#6366F1", bg: "#EEF2FF" },
  Ожидает: { c: "#F59E0B", bg: "#FFFBEB" },
  Запланирован: { c: "#94A3B8", bg: "#F8FAFC" },
  Перерыв: { c: "#CBD5E1", bg: "#F8FAFC" },
};

const NAV_ITEMS = [
  { id: "dashboard", label: "Операционная", icon: LayoutDashboard },
  { id: "queue", label: "Живая очередь", icon: Layers },
  { id: "schedule", label: "Расписание", icon: Calendar },
  { id: "patients", label: "Пациенты", icon: Users },
  { id: "doctors", label: "Врачи", icon: Stethoscope },
  { id: "reports", label: "Отчёты", icon: FileText },
];

// ─── Atoms ────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_CFG[status] ?? { c: "#94A3B8", bg: "#F8FAFC" };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ color: s.c, background: s.bg }}
    >
      <span
        className="w-1 h-1 rounded-full flex-shrink-0"
        style={{ background: s.c }}
      />
      {status}
    </span>
  );
}

function Rule() {
  return <div style={{ borderColor: BORDER }} className="border-t" />;
}

function MetaLabel({ children }) {
  return (
    <p
      className="text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{ color: TEXT3 }}
    >
      {children}
    </p>
  );
}

function GoldAccent() {
  return (
    <span
      className="inline-block w-5 h-px rounded-full"
      style={{ background: GOLD }}
    />
  );
}

// Premium card with refined shadow
function Card({ children, className = "", noPad = false }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden ${noPad ? "" : ""} ${className}`}
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        boxShadow:
          "0 1px 3px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)",
      }}
    >
      {children}
    </div>
  );
}

function PrimaryBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
      style={{
        background: `linear-gradient(135deg, ${ACCENT_DIM} 0%, #0284C7 100%)`,
        boxShadow: `0 2px 8px rgba(14,165,233,0.35)`,
      }}
    >
      {children}
    </button>
  );
}

function SectionHead({ meta, title, cta }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div className="space-y-1.5">
        <MetaLabel>{meta}</MetaLabel>
        <GoldAccent />
        <h2 className="text-lg font-semibold" style={{ color: TEXT1 }}>
          {title}
        </h2>
      </div>
      {cta && (
        <button
          className="flex items-center gap-1 text-xs font-semibold hover:underline transition-all"
          style={{ color: ACCENT_DIM }}
        >
          {cta} <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const KPI_DATA = [
  { meta: "Пациентов сегодня", val: "19", sub: "+3 к вчера", trend: 1 },
  { meta: "Завершено приёмов", val: "3 / 12", sub: "25% выполнено", trend: 0 },
  { meta: "В очереди", val: "3", sub: "avg 18 мин", trend: 0 },
  { meta: "Выручка", val: "47 200 ₽", sub: "+12% к вчера", trend: 1 },
  { meta: "Не явились", val: "1", sub: "1.8% от записей", trend: -1 },
  { meta: "Загрузка клиники", val: "68%", sub: "3 из 4 кабинетов", trend: 0 },
];

function DashboardTab() {
  return (
    <div className="space-y-7">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {KPI_DATA.map((k, i) => (
          <Card key={i}>
            <div className="p-5">
              <MetaLabel>{k.meta}</MetaLabel>
              <div
                className="mt-3 mb-1 text-[28px] font-light tabular-nums leading-none"
                style={{ color: TEXT1, letterSpacing: "-0.02em" }}
              >
                {k.val}
              </div>
              <div className="flex items-center gap-1 mt-2">
                {k.trend === 1 && <ArrowUp size={11} color="#10B981" />}
                {k.trend === -1 && <ArrowDown size={11} color="#EF4444" />}
                {k.trend === 0 && <Minus size={11} color={TEXT3} />}
                <span
                  className="text-[11px]"
                  style={{
                    color:
                      k.trend === 1
                        ? "#10B981"
                        : k.trend === -1
                          ? "#EF4444"
                          : TEXT3,
                  }}
                >
                  {k.sub}
                </span>
              </div>
            </div>
            {/* gold bottom accent on first card */}
            {i === 0 && (
              <div
                className="h-0.5"
                style={{
                  background: `linear-gradient(90deg, ${GOLD}, transparent)`,
                }}
              />
            )}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Appointments */}
        <div className="xl:col-span-2">
          <SectionHead
            meta="Сегодня · пн 25 мая"
            title="Приёмы дня"
            cta="Полное расписание"
          />
          <Card>
            {appointments
              .filter((a) => a.status !== "Перерыв")
              .slice(0, 9)
              .map((apt, i, arr) => (
                <div key={apt.id}>
                  <div className="flex items-center gap-4 px-6 py-3.5 hover:bg-[#FAFBFD] transition-colors group cursor-pointer">
                    <span
                      className="text-xs font-mono font-medium w-10 flex-shrink-0"
                      style={{ color: TEXT3 }}
                    >
                      {apt.time}
                    </span>
                    <div
                      className="w-px h-9 rounded-full flex-shrink-0"
                      style={{ background: apt.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: TEXT1 }}
                        >
                          {apt.patient}
                        </span>
                        {apt.status === "В кабинете" && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: "#EFF9FE",
                              color: ACCENT_DIM,
                              border: `1px solid ${ACCENT}40`,
                            }}
                          >
                            ● СЕЙЧАС
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: TEXT3 }}>
                        {apt.type}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
                      <span className="text-xs" style={{ color: TEXT2 }}>
                        {apt.doctor}
                      </span>
                      <span className="text-xs" style={{ color: TEXT3 }}>
                        Каб. {apt.room}
                      </span>
                      <StatusBadge status={apt.status} />
                    </div>
                  </div>
                  {i < arr.length - 1 && <Rule />}
                </div>
              ))}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Doctors */}
          <div>
            <SectionHead meta="Персонал" title="Врачи" />
            <Card>
              {doctors.map((doc, i) => (
                <div key={doc.id}>
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${ACCENT_DIM} 0%, #0369A1 100%)`,
                          boxShadow: `0 2px 8px rgba(14,165,233,0.3)`,
                        }}
                      >
                        {doc.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{ color: TEXT1 }}
                        >
                          {doc.name}
                        </p>
                        <p className="text-xs" style={{ color: TEXT3 }}>
                          {doc.specialty}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p
                          className="text-sm font-semibold tabular-nums"
                          style={{ color: TEXT1 }}
                        >
                          {doc.done}
                          <span
                            style={{ color: TEXT3 }}
                            className="font-normal"
                          >
                            /{doc.patients}
                          </span>
                        </p>
                        <StatusBadge status={doc.status} />
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div
                      className="h-1 rounded-full overflow-hidden"
                      style={{ background: "#EFF6FF" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(doc.done / doc.patients) * 100}%`,
                          background: `linear-gradient(90deg, ${ACCENT_DIM}, ${ACCENT})`,
                        }}
                      />
                    </div>
                  </div>
                  {i < doctors.length - 1 && <Rule />}
                </div>
              ))}
            </Card>
          </div>

          {/* Queue */}
          <div>
            <SectionHead meta="Очередь" title="Сейчас" cta="Подробнее" />
            <Card>
              {[
                {
                  label: "Ожидают",
                  n: queue.waiting.length,
                  c: "#F59E0B",
                  bg: "#FFFBEB",
                },
                {
                  label: "В кабинете",
                  n: queue.inRoom.length,
                  c: "#6366F1",
                  bg: "#EEF2FF",
                },
                {
                  label: "Оформление",
                  n: queue.processing.length,
                  c: ACCENT_DIM,
                  bg: "#F0F9FF",
                },
                {
                  label: "Завершено",
                  n: queue.done.length,
                  c: "#10B981",
                  bg: "#ECFDF5",
                },
              ].map((row, i, arr) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: row.bg }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: row.c }}
                        />
                      </div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: TEXT1 }}
                      >
                        {row.label}
                      </span>
                    </div>
                    <span
                      className="text-2xl font-light tabular-nums"
                      style={{ color: row.c, letterSpacing: "-0.02em" }}
                    >
                      {row.n}
                    </span>
                  </div>
                  {i < arr.length - 1 && <Rule />}
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── QUEUE ────────────────────────────────────────────────────────────────────
function QueueTab() {
  const cols = [
    { id: "waiting", label: "Ожидает", accent: "#F59E0B", accentBg: "#FFFBEB" },
    {
      id: "inRoom",
      label: "В кабинете",
      accent: "#6366F1",
      accentBg: "#EEF2FF",
    },
    {
      id: "processing",
      label: "Оформление",
      accent: ACCENT_DIM,
      accentBg: "#F0F9FF",
    },
    { id: "done", label: "Завершено", accent: "#10B981", accentBg: "#ECFDF5" },
  ];
  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div className="space-y-1.5">
          <MetaLabel>Живая очередь</MetaLabel>
          <GoldAccent />
          <h2 className="text-lg font-semibold" style={{ color: TEXT1 }}>
            Обновлено 10:47 &nbsp;
            <span className="text-xs font-bold" style={{ color: "#10B981" }}>
              ● в эфире
            </span>
          </h2>
        </div>
        <PrimaryBtn>
          <Plus size={15} /> Добавить пациента
        </PrimaryBtn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {cols.map((col) => {
          const items = queue[col.id];
          return (
            <div
              key={col.id}
              className="flex flex-col rounded-2xl overflow-hidden"
              style={{
                border: `1px solid ${BORDER}`,
                background: "#FAFBFD",
                boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3.5 bg-white border-b"
                style={{ borderColor: BORDER }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ background: col.accentBg }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: col.accent }}
                    />
                  </div>
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: TEXT1 }}
                  >
                    {col.label}
                  </span>
                </div>
                <span
                  className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center text-white"
                  style={{ background: col.accent }}
                >
                  {items.length}
                </span>
              </div>

              <div className="p-3 space-y-2 flex-1">
                {items.length === 0 && (
                  <p
                    className="text-center py-10 text-xs"
                    style={{ color: TEXT3 }}
                  >
                    Нет записей
                  </p>
                )}

                {col.id === "waiting" &&
                  queue.waiting.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-xl p-3.5 group cursor-pointer transition-all hover:-translate-y-0.5"
                      style={{
                        border: `1px solid ${BORDER}`,
                        boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
                      }}
                    >
                      <div className="flex items-start justify-between mb-2.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            {p.priority && (
                              <AlertCircle size={11} color="#EF4444" />
                            )}
                            <span
                              className="text-sm font-semibold"
                              style={{ color: TEXT1 }}
                            >
                              {p.patient}
                            </span>
                          </div>
                          <p
                            className="text-[11px] mt-0.5 font-mono"
                            style={{ color: TEXT3 }}
                          >
                            Талон {p.ticketNo}
                          </p>
                        </div>
                        <MoreHorizontal
                          size={13}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: TEXT3 }}
                        />
                      </div>
                      <Rule />
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-xs" style={{ color: TEXT2 }}>
                          {p.doctor}
                        </span>
                        <span
                          className="text-xs font-semibold flex items-center gap-1"
                          style={{ color: "#F59E0B" }}
                        >
                          <Clock size={10} /> {p.waitTime}
                        </span>
                      </div>
                    </div>
                  ))}

                {col.id === "inRoom" &&
                  queue.inRoom.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl p-3.5"
                      style={{
                        background: "#EEF2FF",
                        border: `2px solid #6366F1`,
                      }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase tracking-widest mb-2"
                        style={{ color: "#6366F1" }}
                      >
                        ● На приёме
                      </p>
                      <p
                        className="text-sm font-semibold mb-0.5"
                        style={{ color: TEXT1 }}
                      >
                        {p.patient}
                      </p>
                      <p className="text-[11px]" style={{ color: TEXT2 }}>
                        Каб. {p.room} · {p.doctor}
                      </p>
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <Clock size={11} color="#6366F1" />
                        <span
                          className="text-xs font-semibold"
                          style={{ color: "#6366F1" }}
                        >
                          {p.inRoomTime} в кабинете
                        </span>
                      </div>
                    </div>
                  ))}

                {col.id === "processing" &&
                  queue.processing.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-xl p-3.5"
                      style={{
                        border: `1px solid ${BORDER}`,
                        boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
                      }}
                    >
                      <p
                        className="text-sm font-semibold mb-0.5"
                        style={{ color: TEXT1 }}
                      >
                        {p.patient}
                      </p>
                      <p
                        className="text-[11px] font-mono mb-2.5"
                        style={{ color: TEXT3 }}
                      >
                        Талон {p.ticketNo}
                      </p>
                      <div
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                        style={{ background: "#F0F9FF", color: ACCENT_DIM }}
                      >
                        {p.task}
                      </div>
                      <p className="text-[11px] mt-2" style={{ color: TEXT3 }}>
                        {p.staff}
                      </p>
                    </div>
                  ))}

                {col.id === "done" &&
                  queue.done.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-xl px-3.5 py-3"
                      style={{ border: `1px solid ${BORDER}` }}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <CheckCircle size={12} color="#10B981" />
                        <span
                          className="text-sm font-medium"
                          style={{ color: TEXT1 }}
                        >
                          {p.patient}
                        </span>
                      </div>
                      <p className="text-[11px]" style={{ color: TEXT3 }}>
                        {p.doctor} · {p.endTime}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SCHEDULE ─────────────────────────────────────────────────────────────────
function ScheduleTab() {
  const [selDoc, setSelDoc] = useState("Все врачи");
  const opts = ["Все врачи", ...doctors.map((d) => d.name)];
  const filtered =
    selDoc === "Все врачи"
      ? appointments
      : appointments.filter((a) => a.doctor === selDoc);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div className="space-y-1.5">
          <MetaLabel>Расписание</MetaLabel>
          <GoldAccent />
          <h2 className="text-lg font-semibold" style={{ color: TEXT1 }}>
            Понедельник, 25 мая 2026
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selDoc}
              onChange={(e) => setSelDoc(e.target.value)}
              className="appearance-none rounded-xl pl-3 pr-8 py-2 text-sm font-medium focus:outline-none cursor-pointer"
              style={{
                background: CARD_BG,
                border: `1px solid ${BORDER}`,
                color: TEXT1,
              }}
            >
              {opts.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: TEXT3 }}
            />
          </div>
          <PrimaryBtn>
            <Plus size={15} /> Записать
          </PrimaryBtn>
        </div>
      </div>

      <Card>
        <div
          className="grid grid-cols-12 border-b px-6 py-3"
          style={{ borderColor: BORDER, background: "#FAFBFD" }}
        >
          {[
            ["col-span-1", "Время"],
            ["col-span-3", "Пациент"],
            ["col-span-3", "Тип приёма"],
            ["col-span-3", "Врач / Кабинет"],
            ["col-span-2", "Статус"],
          ].map(([cls, h]) => (
            <div
              key={h}
              className={`${cls} text-[10px] font-bold uppercase tracking-[0.1em]`}
              style={{ color: TEXT3 }}
            >
              {h}
            </div>
          ))}
        </div>

        {filtered.map((apt, i, arr) => {
          const isBreak = apt.status === "Перерыв";
          return (
            <div key={apt.id}>
              <div
                className={`grid grid-cols-12 items-center px-6 py-3.5 transition-colors group ${isBreak ? "" : "hover:bg-[#FAFBFD] cursor-pointer"}`}
                style={isBreak ? { background: "#F8FAFC" } : {}}
              >
                <div className="col-span-1 flex items-center gap-2">
                  <div
                    className="w-0.5 h-7 rounded-full flex-shrink-0"
                    style={{ background: apt.color }}
                  />
                  <span
                    className="text-xs font-mono font-medium"
                    style={{ color: TEXT3 }}
                  >
                    {apt.time}
                  </span>
                </div>
                <div className="col-span-3">
                  {isBreak ? (
                    <span className="text-sm italic" style={{ color: TEXT3 }}>
                      —
                    </span>
                  ) : (
                    <span
                      className="text-sm font-semibold"
                      style={{ color: TEXT1 }}
                    >
                      {apt.patient}
                    </span>
                  )}
                </div>
                <div className="col-span-3 text-sm" style={{ color: TEXT2 }}>
                  {isBreak ? "Обеденный перерыв" : apt.type}
                </div>
                <div className="col-span-3">
                  {!isBreak && (
                    <>
                      <p
                        className="text-sm font-medium"
                        style={{ color: TEXT1 }}
                      >
                        {apt.doctor}
                      </p>
                      <p className="text-xs" style={{ color: TEXT3 }}>
                        Каб. {apt.room} · {apt.duration} мин
                      </p>
                    </>
                  )}
                </div>
                <div className="col-span-2 flex items-center justify-between">
                  {!isBreak && <StatusBadge status={apt.status} />}
                  {!isBreak && (
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-[#F1F5F9]">
                      <MoreHorizontal size={13} style={{ color: TEXT3 }} />
                    </button>
                  )}
                </div>
              </div>
              {i < arr.length - 1 && <Rule />}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ─── PATIENTS ─────────────────────────────────────────────────────────────────
function PatientsTab() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Все");

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    const ok =
      p.name.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.diagnosis.toLowerCase().includes(q);
    return ok && (filter === "Все" || p.status === filter);
  });

  const bal = (b) =>
    b > 0
      ? { text: `+${b.toLocaleString("ru")} ₽`, color: "#10B981" }
      : b < 0
        ? { text: `${b.toLocaleString("ru")} ₽`, color: "#EF4444" }
        : { text: "0 ₽", color: TEXT3 };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div className="space-y-1.5">
          <MetaLabel>Реестр пациентов</MetaLabel>
          <GoldAccent />
          <h2 className="text-lg font-semibold" style={{ color: TEXT1 }}>
            {patients.length} пациентов
          </h2>
        </div>
        <PrimaryBtn>
          <Plus size={15} /> Новый пациент
        </PrimaryBtn>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={13}
            className="absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: TEXT3 }}
          />
          <input
            type="text"
            placeholder="Поиск по имени, телефону, диагнозу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              color: TEXT1,
            }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {["Все", "Активный", "Новый", "В архиве"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={
                filter === s
                  ? { background: TEXT1, color: "#fff" }
                  : {
                      background: CARD_BG,
                      color: TEXT2,
                      border: `1px solid ${BORDER}`,
                    }
              }
            >
              {s}
            </button>
          ))}
          <button
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
            style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              color: TEXT2,
            }}
          >
            <Download size={13} /> Экспорт
          </button>
        </div>
      </div>

      <Card>
        <div
          className="grid grid-cols-12 px-6 py-3 border-b"
          style={{ borderColor: BORDER, background: "#FAFBFD" }}
        >
          {[
            ["col-span-4", "Пациент"],
            ["col-span-2", "Телефон"],
            ["col-span-1", "Д.р."],
            ["col-span-2", "Врач"],
            ["col-span-1", "Визит"],
            ["col-span-1", "Баланс"],
            ["col-span-1", "Статус"],
          ].map(([cls, h]) => (
            <div
              key={h}
              className={`${cls} text-[10px] font-bold uppercase tracking-[0.1em]`}
              style={{ color: TEXT3 }}
            >
              {h}
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16"
            style={{ color: TEXT3 }}
          >
            <Users size={36} className="mb-3 opacity-30" />
            <p className="text-sm">Пациенты не найдены</p>
          </div>
        ) : (
          filtered.map((p, i, arr) => {
            const b = bal(p.balance);
            const initials = p.name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("");
            return (
              <div key={p.id}>
                <div className="grid grid-cols-12 items-center px-6 py-3.5 hover:bg-[#FAFBFD] transition-colors group cursor-pointer">
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${ACCENT_DIM} 0%, #0369A1 100%)`,
                      }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: TEXT1 }}
                      >
                        {p.name}
                      </p>
                      <p className="text-xs truncate" style={{ color: TEXT3 }}>
                        {p.diagnosis}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-2 text-sm" style={{ color: TEXT2 }}>
                    {p.phone}
                  </div>
                  <div className="col-span-1 text-xs" style={{ color: TEXT3 }}>
                    {p.dob}
                  </div>
                  <div className="col-span-2 text-sm" style={{ color: TEXT2 }}>
                    {p.doctor}
                  </div>
                  <div className="col-span-1 text-xs" style={{ color: TEXT3 }}>
                    {p.lastVisit}
                  </div>
                  <div
                    className="col-span-1 text-sm font-semibold"
                    style={{ color: b.color }}
                  >
                    {b.text}
                  </div>
                  <div className="col-span-1 flex items-center justify-between">
                    <StatusBadge status={p.status} />
                    <ChevronRight
                      size={13}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: TEXT3 }}
                    />
                  </div>
                </div>
                {i < arr.length - 1 && <Rule />}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

// ─── DOCTORS ──────────────────────────────────────────────────────────────────
function DoctorsTab() {
  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div className="space-y-1.5">
          <MetaLabel>Персонал</MetaLabel>
          <GoldAccent />
          <h2 className="text-lg font-semibold" style={{ color: TEXT1 }}>
            Врачи · {doctors.length} активных
          </h2>
        </div>
        <PrimaryBtn>
          <Plus size={15} /> Добавить врача
        </PrimaryBtn>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {doctors.map((doc) => (
          <Card
            key={doc.id}
            className="hover:translate-y-[-2px] transition-transform"
          >
            <div className="p-5">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm"
                    style={{
                      background: `linear-gradient(135deg, ${ACCENT_DIM} 0%, #0369A1 100%)`,
                      boxShadow: `0 4px 12px rgba(14,165,233,0.35)`,
                    }}
                  >
                    {doc.avatar}
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: TEXT1 }}>
                      {doc.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: TEXT3 }}>
                      {doc.specialty}
                    </p>
                  </div>
                </div>
                <StatusBadge status={doc.status} />
              </div>

              <div
                className="grid grid-cols-3 rounded-xl overflow-hidden mb-4"
                style={{ background: BODY_BG }}
              >
                {[
                  { label: "Записей", v: doc.patients, c: TEXT1 },
                  { label: "Принято", v: doc.done, c: "#10B981" },
                  {
                    label: "Осталось",
                    v: doc.patients - doc.done,
                    c: "#F59E0B",
                  },
                ].map((s, si) => (
                  <div
                    key={s.label}
                    className={`text-center py-3 ${si < 2 ? "border-r" : ""}`}
                    style={{ borderColor: BORDER }}
                  >
                    <p
                      className="text-xl font-light tabular-nums"
                      style={{ color: s.c, letterSpacing: "-0.02em" }}
                    >
                      {s.v}
                    </p>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider mt-0.5"
                      style={{ color: TEXT3 }}
                    >
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: TEXT3 }}
                  >
                    Прогресс дня
                  </span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: ACCENT_DIM }}
                  >
                    {Math.round((doc.done / doc.patients) * 100)}%
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "#EFF6FF" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(doc.done / doc.patients) * 100}%`,
                      background: `linear-gradient(90deg, ${ACCENT_DIM}, ${ACCENT})`,
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function MedicalCRM() {
  const [active, setActive] = useState("dashboard");

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif", background: BODY_BG }}
    >
      {/* ══ TOP NAVIGATION ══════════════════════════════════════════════════════ */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-6"
        style={{
          background: NAV_BG,
          borderBottom: `1px solid ${NAV_BORDER}`,
          height: "56px",
        }}
      >
        {/* Left: logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${ACCENT_DIM} 0%, #0369A1 100%)`,
            }}
          >
            <HeartPulse size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-tight tracking-tight">
              МедиЦентр
            </p>
            <p className="text-[10px] font-medium" style={{ color: "#4B5E72" }}>
              Частная клиника
            </p>
          </div>

          {/* Divider */}
          <div className="w-px h-5 mx-2" style={{ background: NAV_BORDER }} />

          {/* Nav items */}
          <nav className="flex items-center gap-0.5">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const on = active === id;
              return (
                <button
                  key={id}
                  onClick={() => setActive(id)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
                  style={
                    on
                      ? { background: "#172030", color: "#FFFFFF" }
                      : { color: "#6B7C93", background: "transparent" }
                  }
                >
                  <Icon size={14} className="flex-shrink-0" />
                  <span>{label}</span>
                  {on && (
                    <span
                      className="w-1 h-1 rounded-full flex-shrink-0"
                      style={{ background: ACCENT }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Search */}
          <div className="relative hidden lg:block">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "#4B5E72" }}
            />
            <input
              type="text"
              placeholder="Поиск..."
              className="pl-8 pr-4 py-1.5 rounded-lg text-sm placeholder-[#4B5E72] focus:outline-none w-40"
              style={{
                background: "#172030",
                border: `1px solid ${NAV_BORDER}`,
                color: "#CBD5E1",
              }}
            />
          </div>

          <button
            className="p-2 rounded-lg transition-colors hover:bg-[#172030]"
            style={{ color: "#4B5E72" }}
          >
            <RefreshCw size={15} />
          </button>

          <button
            className="relative p-2 rounded-lg transition-colors hover:bg-[#172030]"
            style={{ color: "#4B5E72" }}
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
          </button>

          {/* Date chip */}
          <div
            className="hidden sm:flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold ml-1"
            style={{
              background: "#172030",
              color: ACCENT,
              border: `1px solid ${NAV_BORDER}`,
            }}
          >
            Пн, 25 мая 2026
          </div>

          {/* Divider */}
          <div className="w-px h-5 mx-1" style={{ background: NAV_BORDER }} />

          {/* Avatar */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer hover:bg-[#172030] transition-colors">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
              style={{
                background: `linear-gradient(135deg, ${ACCENT_DIM} 0%, #0369A1 100%)`,
              }}
            >
              АД
            </div>
            <div className="hidden sm:block">
              <p
                className="text-xs font-semibold leading-tight"
                style={{ color: "#CBD5E1" }}
              >
                Администратор
              </p>
            </div>
            <ChevronDown size={12} style={{ color: "#4B5E72" }} />
          </div>

          <button
            className="p-2 rounded-lg transition-colors hover:bg-[#172030]"
            style={{ color: "#4B5E72" }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* ══ GOLD ACCENT LINE ════════════════════════════════════════════════════ */}
      <div
        className="h-px flex-shrink-0"
        style={{
          background: `linear-gradient(90deg, ${GOLD}60, transparent 60%)`,
        }}
      />

      {/* ══ PAGE CONTENT ════════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1440px] mx-auto px-6 py-7">
          {active === "dashboard" && <DashboardTab />}
          {active === "queue" && <QueueTab />}
          {active === "schedule" && <ScheduleTab />}
          {active === "patients" && <PatientsTab />}
          {active === "doctors" && <DoctorsTab />}
          {active === "reports" && (
            <div
              className="flex flex-col items-center justify-center h-64"
              style={{ color: TEXT3 }}
            >
              <Activity size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Отчёты в разработке</p>
              <p className="text-xs mt-1 opacity-60">
                Скоро здесь появится аналитика
              </p>
            </div>
          )}
        </div>
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
