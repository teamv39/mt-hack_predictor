import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  CheckCircle2,
  Check,
  Clock,
  AlertTriangle,
  Volume2,
  Users,
  RotateCcw,
  ArrowRight,
  Shield,
  Gauge,
  Zap,
  Radio,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";
import { loadPreferences, savePreferences } from "../utils/storage";

interface DriverTerminalProps {
  vehicleId?: string;
  routeNumber?: string;
  isHoldingActive?: boolean;
  onAcknowledge?: () => void;
  isDarkMode?: boolean;
}

interface StationScheduleItem {
  id: number;
  name: string;
  timeLabel: string;
  statusText: string;
  isCurrent?: boolean;
  isPassed?: boolean;
  deltaText?: string;
}

interface FleetTerminalUnit {
  route: string;
  id: string;
  badgeBg: string;
  role: string;
  directive: string;
  desc: string;
  isHold: boolean;
  currentStop: string;
  targetStop: string;
  speed: number;
  gear: string;
  rearBus: string;
  rearInterval: string;
  frontBus: string;
  frontInterval: string;
  batterySoc: number;
  batteryKm: number;
  stations: StationScheduleItem[];
  gapSchema: {
    rearTitle: string;
    rearSubtitle: string;
    gapStatus: string;
    frontTitle: string;
    frontSubtitle: string;
    distance: string;
  };
}

const FLEET_TERMINALS: FleetTerminalUnit[] = [
  {
    route: "м3",
    id: "1043",
    badgeBg: "bg-[#D32F2F]",
    role: "Лидер (Holding)",
    directive: "Регулировочная стоянка (Холдинг)",
    desc: "Остановка «Метро Бауманская» • Устранение пачкования, выравнивание такта до 7.5 мин",
    isHold: true,
    currentStop: "м. Бауманская",
    targetStop: "Бакунинская ул., 84",
    speed: 0,
    gear: "Ручной тормоз [P]",
    rearBus: "Ведомый #1042",
    rearInterval: "1.4 мин → 7.5 мин",
    frontBus: "Лидер #1041",
    frontInterval: "8.2 мин",
    batterySoc: 84,
    batteryKm: 142,
    stations: [
      { id: 13, name: "ул. Покровка", timeLabel: "Пройдена в 14:41", statusText: "Пройдено", isPassed: true },
      { id: 14, name: "м. Бауманская", timeLabel: "Текущая стоянка", statusText: "ТЕКУЩАЯ", isCurrent: true },
      { id: 15, name: "Бакунинская ул., 84", timeLabel: "Расчетное: 14:51:00", statusText: "В графике", deltaText: "Δ 7.5 мин" },
      { id: 16, name: "м. Электрозаводская", timeLabel: "Расчетное: 14:54:30", statusText: "В графике", deltaText: "Δ 7.8 мин" },
      { id: 17, name: "м. Семёновская", timeLabel: "Расчетное: 14:58:00", statusText: "Финиш", deltaText: "Норма" },
    ],
    gapSchema: {
      rearTitle: "Ведомый #1042",
      rearSubtitle: "Сзади • сокращает разрыв",
      gapStatus: "Разрыв восстанавливается → Такт 7.5 мин",
      frontTitle: "Ваш борт #1043 (Лидер)",
      frontSubtitle: "На стоянке • выдержка такта",
      distance: "Дистанция: 480 м (увеличивается)",
    },
  },
  {
    route: "м3",
    id: "1042",
    badgeBg: "bg-[#D32F2F]",
    role: "Ведомый (Нагон)",
    directive: "Следование по расписанию (Нагон ликвидирован)",
    desc: "Лидер №1043 выдерживает такт на м. Бауманская • Вход в график через 1 перегон",
    isHold: false,
    currentStop: "Бакунинская ул., 84",
    targetStop: "м. Электрозаводская",
    speed: 28,
    gear: "Ход D • 28 км/ч",
    rearBus: "Ведомый #1044",
    rearInterval: "7.8 мин",
    frontBus: "Лидер #1043",
    frontInterval: "7.5 мин",
    batterySoc: 76,
    batteryKm: 128,
    stations: [
      { id: 14, name: "м. Бауманская", timeLabel: "Пройдена в 14:44", statusText: "Пройдено", isPassed: true },
      { id: 15, name: "Бакунинская ул., 84", timeLabel: "Текущий перегон", statusText: "В ПУТИ", isCurrent: true },
      { id: 16, name: "м. Электрозаводская", timeLabel: "Расчетное: 14:49:15", statusText: "В графике", deltaText: "Δ 7.5 мин" },
      { id: 17, name: "м. Семёновская", timeLabel: "Расчетное: 14:53:00", statusText: "Финиш", deltaText: "Норма" },
    ],
    gapSchema: {
      rearTitle: "Ваш борт #1042 (Ведомый)",
      rearSubtitle: "В движении • выравнивание",
      gapStatus: "Оптимальный интервал достигнут (7.5 мин)",
      frontTitle: "Лидер #1043",
      frontSubtitle: "Впереди • м. Бауманская (+520 м)",
      distance: "Дистанция: 520 м (стабилизирована)",
    },
  },
  {
    route: "м7",
    id: "2198",
    badgeBg: "bg-[#0284c7]",
    role: "Задержка (Зелёный коридор)",
    directive: "Приоритетный коридор АСУДД (Зелёный свет)",
    desc: "Затор на ул. Николоямская • Адаптивное продление фазы светофора Т-12 на 18 сек для нагона",
    isHold: false,
    currentStop: "ул. Николоямская",
    targetStop: "Яузские Ворота",
    speed: 14,
    gear: "Ход D • Фаза Т-12",
    rearBus: "Борт #2195",
    rearInterval: "8.5 мин",
    frontBus: "Лидер #2199",
    frontInterval: "14.0 мин → 9.0 мин",
    batterySoc: 68,
    batteryKm: 114,
    stations: [
      { id: 9, name: "Таганская пл.", timeLabel: "Пройдена в 14:39", statusText: "Пройдено", isPassed: true },
      { id: 10, name: "ул. Николоямская", timeLabel: "Зелёный коридор активен", statusText: "ТЕКУЩАЯ", isCurrent: true },
      { id: 11, name: "Яузские Ворота", timeLabel: "Расчетное: 14:48:30", statusText: "Нагон +1.5м", deltaText: "Δ 9.0 мин" },
      { id: 12, name: "Солянка", timeLabel: "Расчетное: 14:52:00", statusText: "В графике", deltaText: "Норма" },
      { id: 13, name: "м. Китай-город", timeLabel: "Расчетное: 14:56:00", statusText: "Финиш", deltaText: "Норма" },
    ],
    gapSchema: {
      rearTitle: "Ваш борт #2198",
      rearSubtitle: "Узел Николоямская • нагон",
      gapStatus: "Зеленый коридор Т-12 открыт → Нагон +1.5 мин",
      frontTitle: "Лидер #2199",
      frontSubtitle: "Впереди • Таганский узел",
      distance: "Дистанция: 1 100 м (сокращается)",
    },
  },
  {
    route: "т88",
    id: "0814",
    badgeBg: "bg-[#7c3aed]",
    role: "Риск такта (Skip-Stop)",
    directive: "Динамическая увязка такта (Режим Skip-Stop)",
    desc: "Сжатие интервала на Садовой-Черногрязской • Экспресс-пропуск остановки для стабилизации",
    isHold: false,
    currentStop: "Садовая-Черногрязская",
    targetStop: "м. Красные Ворота",
    speed: 31,
    gear: "Ход D • Экспресс",
    rearBus: "Борт #0812",
    rearInterval: "7.0 мин",
    frontBus: "Лидер #0815",
    frontInterval: "7.0 мин",
    batterySoc: 88,
    batteryKm: 154,
    stations: [
      { id: 3, name: "Краснопрудная ул.", timeLabel: "Пройдена в 14:42", statusText: "Пройдено", isPassed: true },
      { id: 4, name: "Садовая-Черногрязская", timeLabel: "Экспресс-проход", statusText: "SKIP-STOP", isCurrent: true },
      { id: 5, name: "м. Красные Ворота", timeLabel: "Расчетное: 14:48:00", statusText: "В графике", deltaText: "Δ 7.0 мин" },
      { id: 6, name: "Мясницкая ул.", timeLabel: "Расчетное: 14:52:00", statusText: "В графике", deltaText: "Норма" },
      { id: 7, name: "м. Лубянка", timeLabel: "Расчетное: 14:56:00", statusText: "Финиш", deltaText: "Норма" },
    ],
    gapSchema: {
      rearTitle: "Ваш борт #0814",
      rearSubtitle: "Режим Skip-Stop активен",
      gapStatus: "Такт синхронизирован → Равномерный ход 7.0 мин",
      frontTitle: "Лидер #0815",
      frontSubtitle: "Впереди • м. Красные Ворота",
      distance: "Дистанция: 650 м (оптимум)",
    },
  },
];

export const DriverTerminal: React.FC<DriverTerminalProps> = ({
  vehicleId = "1043",
  routeNumber = "м3",
  isHoldingActive = true,
  onAcknowledge,
  isDarkMode = false,
}) => {
  const initialPrefs = useMemo(() => loadPreferences(), []);

  const [currentUnitId, setCurrentUnitId] = useState<string>(() => {
    const clean = vehicleId ? vehicleId.replace(/^P/, "") : "1043";
    if (FLEET_TERMINALS.some((u) => u.id === clean)) return clean;
    return "1043";
  });

  useEffect(() => {
    if (vehicleId) {
      const clean = vehicleId.replace(/^P/, "");
      if (FLEET_TERMINALS.some((u) => u.id === clean)) {
        setCurrentUnitId(clean);
      }
    }
  }, [vehicleId]);

  const activeUnit = useMemo(() => {
    return FLEET_TERMINALS.find((u) => u.id === currentUnitId) || FLEET_TERMINALS[0];
  }, [currentUnitId]);

  const [holdingDeadline, setHoldingDeadline] = useState<number>(() => {
    if (initialPrefs.holdingDeadline && initialPrefs.holdingDeadline > Date.now()) {
      return initialPrefs.holdingDeadline;
    }
    const newDeadline = Date.now() + 150 * 1000;
    savePreferences({ holdingDeadline: newDeadline });
    return newDeadline;
  });

  const [isAcked, setIsAcked] = useState<boolean>(() => !!initialPrefs.isTerminalAcked);
  const [ackTime, setAckTime] = useState<string>(() => initialPrefs.ackTimeStr || "");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!activeUnit.isHold) return 0;
    return Math.max(0, Math.round((holdingDeadline - nowMs) / 1000));
  }, [activeUnit.isHold, holdingDeadline, nowMs]);

  const liveClockStr = useMemo(() => {
    const date = new Date(nowMs);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [nowMs]);

  const departureTimeStr = useMemo(() => {
    const depDate = new Date(holdingDeadline);
    const h = String(depDate.getHours()).padStart(2, "0");
    const m = String(depDate.getMinutes()).padStart(2, "0");
    const s = String(depDate.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [holdingDeadline]);

  const totalDuration = 150;
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(((totalDuration - secondsLeft) / totalDuration) * 100))
  );

  const min = Math.floor(secondsLeft / 60);
  const sec = secondsLeft % 60;
  const timerDisplay = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

  const handleAck = () => {
    setIsAcked(true);
    setAckTime(liveClockStr);
    savePreferences({ isTerminalAcked: true, ackTimeStr: liveClockStr });
    if (onAcknowledge) onAcknowledge();
  };

  const handleResetDemo = useCallback(() => {
    const newDeadline = Date.now() + 150 * 1000;
    setHoldingDeadline(newDeadline);
    setIsAcked(false);
    setAckTime("");
    savePreferences({
      holdingDeadline: newDeadline,
      isTerminalAcked: false,
      ackTimeStr: undefined,
    });
  }, []);

  // Telemetry event log items
  const telemetryLogs = useMemo(() => [
    { time: "14:44:50", src: "CAN-02", text: "Датчик дверей: закрыто • Стояночный тормоз [P] активен", ok: true },
    { time: "14:44:58", src: "ГЛОНАСС", text: `Фиксация остановочного пункта: «${activeUnit.currentStop}» • Связь 18 сп.`, ok: true },
    { time: "14:45:00", src: "АСУ-РДС", text: `Принята директива СППР: ${activeUnit.directive} • Статус: подтверждено`, ok: true },
    { time: "14:45:04", src: "АСМПП", text: "Подсчет пассажиров: 48 в салоне (56% загрузка) • Норма", ok: true },
    { time: "14:45:10", src: "NDTP", text: `Пакет телеметрии борта #${activeUnit.id} передан на сервер :9201 • Пинг 8 мс`, ok: true },
  ], [activeUnit]);

  return (
    <div
      className={`w-full h-full flex flex-col font-sans select-none overflow-hidden p-4 gap-3 transition-colors duration-200 justify-between ${
        isDarkMode ? "bg-[#121214] text-zinc-100" : "bg-[#f4f4f5] text-zinc-900"
      }`}
      data-purpose="driver-terminal-root"
    >
      {/* 1. TOP PROMINENT VEHICLE & ROUTE SWITCHER BAR */}
      <div
        className={`rounded-xl p-2.5 border transition-colors flex items-center justify-between gap-3 shrink-0 ${
          isDarkMode
            ? "bg-[#18181b] border-white/10"
            : "bg-white border-zinc-200 shadow-2xs"
        }`}
      >
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          <span className="text-[11px] font-bold font-mono px-2 text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
            <Radio size={13} className="text-emerald-500 animate-pulse" />
            Выбор борта:
          </span>

          {FLEET_TERMINALS.map((u) => {
            const isSelected = u.id === currentUnitId;
            return (
              <button
                key={u.id}
                onClick={() => {
                  setCurrentUnitId(u.id);
                  if (u.isHold && secondsLeft === 0) {
                    handleResetDemo();
                  }
                }}
                className={`h-9 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer shrink-0 border ${
                  isSelected
                    ? isDarkMode
                      ? "bg-zinc-700 text-white border-zinc-400 shadow-md ring-1 ring-white/30"
                      : "bg-zinc-900 text-white border-zinc-900 shadow-md ring-1 ring-zinc-400"
                    : isDarkMode
                    ? "bg-[#222226] text-zinc-300 border-white/10 hover:border-white/30 hover:bg-[#2c2c32]"
                    : "bg-zinc-100 text-zinc-700 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-200"
                }`}
                title={`Переключить кабину на борт №${u.id} (${u.route})`}
              >
                <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold font-mono text-white ${u.badgeBg}`}>
                  {u.route}
                </span>
                <span className="font-mono text-xs font-bold">№{u.id}</span>
                <span className={`text-[11px] font-medium opacity-80 ${isSelected ? "text-zinc-200" : "text-zinc-400"}`}>
                  {u.role}
                </span>
              </button>
            );
          })}
        </div>

        {/* Demo Timer Reset & Master Status */}
        <div className="flex items-center gap-2 shrink-0">
          {activeUnit.isHold && (
            <button
              onClick={handleResetDemo}
              className={`h-8 px-2.5 rounded-lg border text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                isDarkMode
                  ? "bg-[#222226] hover:bg-white/10 border-white/10 text-zinc-300"
                  : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700"
              }`}
              title="Перезапустить 150 с для демонстрации жюри"
            >
              <RotateCcw size={13} />
              <span>150 с</span>
            </button>
          )}

          <div
            className={`h-8 px-3 rounded-lg border flex items-center gap-2 text-xs font-mono font-bold ${
              isDarkMode
                ? "bg-[#222226] border-white/10 text-zinc-300"
                : "bg-zinc-100 border-zinc-200 text-zinc-700"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ЦОДД АСУ-РДС</span>
          </div>
        </div>
      </div>

      {/* 2. DIRECTIVE HEADER BANNER */}
      <header
        className={`rounded-xl p-3 border transition-colors flex items-center justify-between gap-3 shrink-0 ${
          isDarkMode
            ? "bg-[#18181b] border-white/10"
            : "bg-white border-zinc-200 shadow-2xs"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
              activeUnit.isHold
                ? isDarkMode
                  ? "bg-[#222226] border-white/10 text-amber-400"
                  : "bg-amber-50 border-amber-200 text-amber-700"
                : isDarkMode
                ? "bg-[#222226] border-white/10 text-emerald-400"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            {activeUnit.isHold ? <AlertTriangle className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono text-white ${activeUnit.badgeBg}`}>
                {activeUnit.route} • БОРТ #{activeUnit.id}
              </span>
              <h1 className="text-base font-bold tracking-tight">
                {activeUnit.directive}
              </h1>
            </div>
            <p className={`text-xs mt-0.5 ${isDarkMode ? "text-zinc-400" : "text-zinc-600"}`}>
              {activeUnit.desc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="text-right">
            <div className="text-[10px] text-zinc-400 uppercase">Остановочный пункт</div>
            <div className={`font-bold ${isDarkMode ? "text-white" : "text-zinc-900"}`}>
              {activeUnit.currentStop}
            </div>
          </div>
        </div>
      </header>

      {/* 3. DUAL COLUMN WORKSPACE (FLEX-1) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        {/* Left Column: Timetable & Station Schedule (4 cols) */}
        <section
          className={`lg:col-span-4 rounded-xl border p-3.5 flex flex-col justify-between transition-colors min-h-0 ${
            isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200 shadow-2xs"
          }`}
        >
          <div className="flex-1 flex flex-col min-h-0">
            <div
              className={`flex items-center justify-between pb-2.5 border-b shrink-0 ${
                isDarkMode ? "border-white/10" : "border-zinc-100"
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Маршрут {activeUnit.route} • График рейса
              </span>
              <span className="text-[11px] font-mono text-zinc-400">Такт: 7.5 мин</span>
            </div>

            {/* Station Timeline */}
            <div className="mt-2.5 flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1">
              {activeUnit.stations.map((st) => (
                <div
                  key={st.id}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                    st.isCurrent
                      ? activeUnit.isHold
                        ? isDarkMode
                          ? "bg-amber-950/20 border-amber-500/60 text-white"
                          : "bg-amber-50/60 border-amber-400 text-zinc-900"
                        : isDarkMode
                        ? "bg-emerald-950/20 border-emerald-500/60 text-white"
                        : "bg-emerald-50/60 border-emerald-400 text-zinc-900"
                      : st.isPassed
                      ? isDarkMode
                        ? "bg-[#222226] border-white/5 text-zinc-400"
                        : "bg-zinc-50 border-zinc-200 text-zinc-500"
                      : isDarkMode
                      ? "bg-[#222226] border-white/5 text-zinc-300"
                      : "bg-zinc-50 border-zinc-200 text-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center shrink-0 ${
                        st.isCurrent
                          ? activeUnit.isHold
                            ? "bg-amber-500 text-white"
                            : "bg-emerald-500 text-white"
                          : isDarkMode
                          ? "bg-zinc-800 text-zinc-300"
                          : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {st.id}
                    </span>
                    <div>
                      <div className={`text-xs ${st.isPassed ? "line-through opacity-80" : "font-semibold"}`}>
                        {st.name}
                      </div>
                      <div className="text-[9px] font-mono opacity-75">{st.timeLabel}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    {st.isCurrent ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500 text-white">
                        {st.statusText}
                      </span>
                    ) : st.deltaText ? (
                      <span className={`text-[10px] font-mono font-bold ${
                        isDarkMode ? "text-emerald-400" : "text-emerald-600"
                      }`}>
                        {st.deltaText}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                        {st.statusText}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cabin Telemetry Sensor Capsules */}
          <div
            className={`mt-2.5 pt-2.5 border-t grid grid-cols-2 gap-2 text-xs shrink-0 ${
              isDarkMode ? "border-white/10" : "border-zinc-100"
            }`}
          >
            <div
              className={`p-2 rounded-lg border ${
                isDarkMode ? "bg-[#222226] border-white/5" : "bg-zinc-50 border-zinc-200"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
                <Users size={12} className="opacity-70" />
                <span>Салон АСМПП</span>
              </div>
              <div className="font-mono text-xs font-bold mt-1">
                48 <span className="text-[10px] text-zinc-400 font-normal">/ 85 пасс.</span>
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">56% (свободно)</div>
            </div>

            <div
              className={`p-2 rounded-lg border ${
                isDarkMode ? "bg-[#222226] border-white/5" : "bg-zinc-50 border-zinc-200"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
                <Shield size={12} className="opacity-70" />
                <span>Двери ТС</span>
              </div>
              <div className="font-mono text-xs font-bold text-amber-400 mt-1">
                {secondsLeft > 0 ? "ПОСАДКА РАЗРЕШЕНА" : "ДВЕРИ ЗАКРЫТЫ"}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                {activeUnit.gear}
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Holding Timer & Action Stage (8 cols) */}
        <section className="lg:col-span-8 flex flex-col justify-between gap-2.5 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 shrink-0">
            {/* Big Countdown Timer Card (7 cols) */}
            <div
              className={`md:col-span-7 rounded-xl border p-3.5 flex flex-col justify-between transition-colors ${
                isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeUnit.isHold ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                    }`}
                  />
                  {activeUnit.isHold ? "ВРЕМЯ СТОЯНКИ" : "РЕЖИМ ДВИЖЕНИЯ"}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                    isDarkMode
                      ? "bg-[#222226] text-zinc-300 border-white/5"
                      : "bg-zinc-100 text-zinc-600 border-zinc-200"
                  }`}
                >
                  {activeUnit.isHold ? "Норма: 150 с" : "АСУ-РДС: Норма"}
                </span>
              </div>

              {/* High-Legibility Tabular Countdown */}
              <div className="py-2.5 text-center">
                <div
                  className={`text-5xl font-mono font-bold tracking-tight tabular-nums leading-none ${
                    activeUnit.isHold ? "text-amber-500" : "text-emerald-400"
                  }`}
                >
                  {activeUnit.isHold ? (secondsLeft > 0 ? timerDisplay : "00:00") : "НОРМА"}
                </div>
                <p
                  className={`text-xs font-mono uppercase tracking-wider font-bold mt-2 ${
                    activeUnit.isHold
                      ? secondsLeft > 0
                        ? "text-amber-400"
                        : "text-emerald-400"
                      : "text-emerald-400"
                  }`}
                >
                  {activeUnit.isHold
                    ? secondsLeft > 0
                      ? "Идёт технологическая выдержка такта"
                      : "Стоянка завершена • Начать движение"
                    : "Следование в графике • Скорость оптимизирована"}
                </p>
              </div>

              {/* Progress Track */}
              <div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1">
                  <span>Выдержка интервала</span>
                  <span>{activeUnit.isHold ? `${progressPercent}%` : "100%"}</span>
                </div>
                <div
                  className={`w-full h-2 rounded-full overflow-hidden ${
                    isDarkMode ? "bg-zinc-800" : "bg-zinc-200"
                  }`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      activeUnit.isHold ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${activeUnit.isHold ? progressPercent : 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Departure Info & Saloon Announcer (5 cols) */}
            <div className="md:col-span-5 flex flex-col justify-between gap-2.5">
              {/* Target Departure Time */}
              <div
                className={`rounded-xl border p-3 flex flex-col justify-between transition-colors flex-1 ${
                  isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200 shadow-2xs"
                }`}
              >
                <div
                  className={`flex items-center justify-between text-xs ${
                    isDarkMode ? "text-zinc-400" : "text-zinc-500"
                  }`}
                >
                  <span
                    className={`flex items-center gap-1.5 font-bold uppercase tracking-wider ${
                      isDarkMode ? "text-zinc-200" : "text-zinc-700"
                    }`}
                  >
                    <Clock size={13} />
                    Расчетное отправление
                  </span>
                </div>
                <div className="my-1.5 flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-mono font-bold ${
                      isDarkMode ? "text-white" : "text-zinc-900"
                    }`}
                  >
                    {activeUnit.isHold ? departureTimeStr : liveClockStr}
                  </span>
                  <span
                    className={`text-xs font-mono font-semibold ${
                      isDarkMode ? "text-zinc-400" : "text-zinc-500"
                    }`}
                  >
                    МСК
                  </span>
                </div>
                <div
                  className={`text-[10px] font-mono ${
                    isDarkMode ? "text-zinc-400" : "text-zinc-500"
                  }`}
                >
                  Синхронизация АСУ-РДС ±0.1 с
                </div>
              </div>

              {/* Saloon Audio Informant */}
              <div
                className={`rounded-xl border p-3 flex flex-col justify-between transition-colors flex-1 ${
                  isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200 shadow-2xs"
                }`}
              >
                <div
                  className={`flex items-center gap-1.5 text-xs font-semibold ${
                    isDarkMode ? "text-zinc-200" : "text-zinc-800"
                  }`}
                >
                  <Volume2 size={13} />
                  <span>Автоинформатор в салоне</span>
                </div>
                <div
                  className={`text-[11px] italic mt-1 border-l-2 border-zinc-500 pl-2 leading-relaxed ${
                    isDarkMode ? "text-zinc-300" : "text-zinc-700"
                  }`}
                >
                  {activeUnit.isHold
                    ? "«Уважаемые пассажиры, технологическая регулировка интервала движения»."
                    : "«Следующая остановка: " + activeUnit.targetStop + "»."}
                </div>
                <div
                  className={`text-[10px] font-semibold mt-1 flex items-center gap-1 ${
                    isDarkMode ? "text-emerald-400" : "text-emerald-600"
                  }`}
                >
                  <Check size={11} />
                  <span>Оповещение воспроизведено</span>
                </div>
              </div>
            </div>
          </div>

          {/* Inter-vehicle Headway Graphic */}
          <div
            className={`rounded-xl border p-3 flex flex-col gap-2 transition-colors shrink-0 ${
              isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono">
              <span
                className={`font-bold flex items-center gap-1.5 ${
                  isDarkMode ? "text-zinc-300" : "text-zinc-800"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Схема перегона: «{activeUnit.currentStop} → {activeUnit.targetStop}»
              </span>
              <span
                className={`font-semibold text-[11px] ${
                  isDarkMode ? "text-amber-400" : "text-amber-600"
                }`}
              >
                {activeUnit.gapSchema.distance}
              </span>
            </div>

            {/* Gap track */}
            <div
              className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs font-mono ${
                isDarkMode ? "bg-[#141416] border-white/5" : "bg-zinc-50 border-zinc-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-[10px] ${
                    isDarkMode ? "bg-zinc-700" : "bg-zinc-600"
                  }`}
                >
                  {activeUnit.id}
                </span>
                <div>
                  <div
                    className={`font-bold text-xs ${
                      isDarkMode ? "text-zinc-200" : "text-zinc-800"
                    }`}
                  >
                    {activeUnit.gapSchema.rearTitle}
                  </div>
                  <div
                    className={`text-[10px] ${
                      isDarkMode ? "text-zinc-400" : "text-zinc-500"
                    }`}
                  >
                    {activeUnit.gapSchema.rearSubtitle}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center px-4">
                <span
                  className={`text-[10px] font-semibold mb-1 ${
                    isDarkMode ? "text-emerald-400" : "text-emerald-600"
                  }`}
                >
                  {activeUnit.gapSchema.gapStatus}
                </span>
                <div
                  className={`w-full h-1.5 rounded-full relative flex items-center ${
                    isDarkMode ? "bg-zinc-700" : "bg-zinc-300"
                  }`}
                >
                  <div className="h-full bg-emerald-500 rounded-full w-2/3" />
                  <ArrowRight size={12} className="absolute right-0 text-emerald-500" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div>
                  <div
                    className={`font-bold text-xs text-right ${
                      isDarkMode ? "text-emerald-400" : "text-emerald-600"
                    }`}
                  >
                    {activeUnit.gapSchema.frontTitle}
                  </div>
                  <div
                    className={`text-[10px] text-right ${
                      isDarkMode ? "text-zinc-400" : "text-zinc-500"
                    }`}
                  >
                    {activeUnit.gapSchema.frontSubtitle}
                  </div>
                </div>
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">
                  {activeUnit.frontBus.match(/\d+/)?.[0] || "1041"}
                </span>
              </div>
            </div>
          </div>

          {/* Master Confirmation Button */}
          <button
            onClick={handleAck}
            disabled={isAcked}
            className={`w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer shrink-0 ${
              isAcked
                ? "bg-zinc-700 text-zinc-300 cursor-default"
                : "bg-emerald-600 hover:bg-emerald-500 active:scale-98 shadow-emerald-900/20"
            }`}
          >
            {isAcked ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Директива подтверждена водительским терминалом ({ackTime})</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Подтвердить прием и выполнение директивы</span>
              </>
            )}
          </button>
        </section>
      </div>

      {/* 4. EXPANDED CAN TELEMETRY LOG & STATUS STRIP (FILLS REMAINING SPACE) */}
      <div className="flex flex-col gap-2 shrink-0">
        {/* Telemetry Sensor Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div
            className={`p-2 rounded-lg border flex items-center gap-2.5 ${
              isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-md flex flex-col items-center justify-center font-mono font-bold text-xs ${
                isDarkMode ? "bg-zinc-800 text-zinc-200" : "bg-zinc-200 text-zinc-700"
              }`}
            >
              <span>{activeUnit.speed}</span>
              <span className="text-[7px] opacity-75 font-normal">км/ч</span>
            </div>
            <div>
              <div className="text-[9px] text-zinc-400">Скорость ТС</div>
              <div className="font-bold text-amber-500 font-mono text-[11px] truncate">
                {activeUnit.gear}
              </div>
            </div>
          </div>

          <div
            className={`p-2 rounded-lg border flex items-center justify-between ${
              isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200"
            }`}
          >
            <div>
              <div className="text-[9px] text-zinc-400">Сзади {activeUnit.rearBus}</div>
              <div className="font-bold font-mono text-[11px] text-rose-500">
                {activeUnit.rearInterval}
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
              КОРИДОР
            </span>
          </div>

          <div
            className={`p-2 rounded-lg border flex items-center justify-between ${
              isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200"
            }`}
          >
            <div>
              <div className="text-[9px] text-zinc-400">Впереди {activeUnit.frontBus}</div>
              <div className="font-bold font-mono text-[11px] text-emerald-500">
                {activeUnit.frontInterval}
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              НОРМА
            </span>
          </div>

          <div
            className={`p-2 rounded-lg border flex items-center justify-between ${
              isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200"
            }`}
          >
            <div>
              <div className="text-[9px] text-zinc-400">Тяга (SOC) 650V</div>
              <div
                className={`font-bold font-mono text-[11px] ${
                  isDarkMode ? "text-zinc-100" : "text-zinc-900"
                }`}
              >
                {activeUnit.batterySoc}% • {activeUnit.batteryKm} км
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-zinc-400">Диспетчер</div>
              <div
                className={`font-semibold text-[10px] ${
                  isDarkMode ? "text-zinc-300" : "text-zinc-700"
                }`}
              >
                Сектор «Центр»
              </div>
            </div>
          </div>
        </div>

        {/* Live NDTP/CAN Protocol Diagnostic Event Stream */}
        <div
          className={`rounded-lg border px-3 py-2 text-[10px] font-mono flex items-center justify-between gap-4 transition-colors ${
            isDarkMode ? "bg-[#141416] border-white/10 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-600"
          }`}
        >
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-zinc-300 dark:text-zinc-200 uppercase">Бортовой журнал:</span>
          </div>

          <div className="flex-1 flex items-center gap-3 overflow-x-auto">
            {telemetryLogs.slice(0, 3).map((log, i) => (
              <span key={i} className="shrink-0 flex items-center gap-1.5">
                <span className="text-zinc-500">{log.time}</span>
                <span className="px-1 py-0.2 rounded bg-zinc-800 text-zinc-300 text-[9px] font-bold">
                  {log.src}
                </span>
                <span className="truncate max-w-[280px]">{log.text}</span>
                {i < 2 && <span className="text-zinc-600">•</span>}
              </span>
            ))}
          </div>

          <div className="shrink-0 text-[9px] text-zinc-500">
            NDTP v1.2 • TCP :9201
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverTerminal;
