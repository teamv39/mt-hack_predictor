import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  Radio,
  Wifi,
  PhoneCall,
  AlertTriangle,
  Battery,
  ShieldCheck,
  DoorOpen,
  DoorClosed,
  Volume2,
  Sun,
  Moon,
  User,
  Users,
  Gauge,
  RotateCcw,
  Navigation,
  ArrowRight,
} from "lucide-react";
import { loadPreferences, savePreferences } from "../utils/storage";

interface DriverTerminalProps {
  vehicleId?: string;
  routeNumber?: string;
  isHoldingActive?: boolean;
  onAcknowledge?: () => void;
  isDarkMode?: boolean;
}

export const DriverTerminal: React.FC<DriverTerminalProps> = ({
  vehicleId = "1043",
  routeNumber = "м3",
  isHoldingActive = true,
  onAcknowledge,
  isDarkMode: propDarkMode = false,
}) => {
  const initialPrefs = useMemo(() => loadPreferences(), []);

  // Theme control: syncs with global, but driver can also override in cab
  const [internalDarkMode, setInternalDarkMode] = useState<boolean>(propDarkMode);

  // Sync with prop if changed from top bar
  useEffect(() => {
    setInternalDarkMode(propDarkMode);
  }, [propDarkMode]);

  // Persistent Holding Deadline & Acknowledgment
  const [holdingDeadline, setHoldingDeadline] = useState<number>(() => {
    if (initialPrefs.holdingDeadline && initialPrefs.holdingDeadline > Date.now()) {
      return initialPrefs.holdingDeadline;
    }
    // Default 150 seconds (02:30) Holding
    const newDeadline = Date.now() + 150 * 1000;
    savePreferences({ holdingDeadline: newDeadline });
    return newDeadline;
  });

  const [isAcked, setIsAcked] = useState<boolean>(() => !!initialPrefs.isTerminalAcked);
  const [ackTime, setAckTime] = useState<string>(() => initialPrefs.ackTimeStr || "");
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // Master Clock & Countdown Tick (synchronized to real timestamp)
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculated seconds remaining (mathematically tied to deadline)
  const secondsLeft = useMemo(() => {
    if (!isHoldingActive) return 0;
    return Math.max(0, Math.round((holdingDeadline - nowMs) / 1000));
  }, [isHoldingActive, holdingDeadline, nowMs]);

  // Live Current Clock String
  const liveClockStr = useMemo(() => {
    const date = new Date(nowMs);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [nowMs]);

  // Calculated Target Departure Time String (Strictly sync'd to clock + deadline)
  const departureTimeStr = useMemo(() => {
    const depDate = new Date(holdingDeadline);
    const h = String(depDate.getHours()).padStart(2, "0");
    const m = String(depDate.getMinutes()).padStart(2, "0");
    const s = String(depDate.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [holdingDeadline]);

  // Holding duration total (150 sec)
  const totalDuration = 150;
  const progressPercent = Math.min(100, Math.max(0, Math.round(((totalDuration - secondsLeft) / totalDuration) * 100)));

  const min = Math.floor(secondsLeft / 60);
  const sec = secondsLeft % 60;
  const timerDisplay = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

  const isDark = internalDarkMode;

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

  return (
    <div
      className={`w-full h-full flex flex-col font-sans select-none overflow-hidden p-3 gap-2.5 transition-colors duration-200 ${
        isDark ? "bg-[#0b1326] text-[#dae2fd]" : "bg-slate-100 text-slate-800"
      }`}
    >
      {/* 0. SYSTEM CONTEXT EXPLANATION BANNER (Task Relevance) */}
      <div
        className={`px-3 py-1.5 rounded-lg border flex items-center justify-between text-xs font-mono shrink-0 shadow-sm transition-colors ${
          isDark
            ? "bg-[#171f33]/90 border-slate-700/80 text-slate-300"
            : "bg-white border-slate-300 text-slate-700"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            КОМПЛЕКС АСУ-РДС / NDTP
          </span>
          <span className="text-slate-400">|</span>
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            Бортовой терминал «Гранит-Навигатор v4.2» • Исполнительное звено СППР ЦОДД
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isDark ? "bg-amber-950 text-amber-300 border border-amber-800" : "bg-amber-100 text-amber-900 border border-amber-300"
            }`}
          >
            ML T+15 мин ➔ Holding по TCP :9201
          </span>
          <button
            onClick={handleResetDemo}
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
              isDark
                ? "bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300"
                : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
            }`}
            title="Сбросить таймер стоянки на 150 сек для повторной демонстрации"
          >
            <RotateCcw size={10} />
            <span>Сброс 150с</span>
          </button>
          <button
            onClick={() => setInternalDarkMode(!internalDarkMode)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
              isDark
                ? "bg-slate-800 hover:bg-slate-700 border-slate-600 text-amber-300"
                : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
            }`}
            title="Переключить день/ночь в кабине водителя"
          >
            {isDark ? <Sun size={12} className="text-amber-400" /> : <Moon size={12} className="text-blue-600" />}
            <span>{isDark ? "День" : "Ночь"}</span>
          </button>
        </div>
      </div>

      {/* 1. TOP HARDWARE STATUS BAR */}
      <header
        className="border-2 border-slate-700/80 rounded-xl px-4 py-2 flex justify-between items-center shrink-0 shadow-md bg-[#080E1C] text-white transition-colors"
      >
        {/* Brand Anchor & Vehicle Stamp */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#d32f2f] flex items-center justify-center border border-[#ffb3ac] shrink-0 shadow-md">
            <span className="font-mono font-black text-white text-xs">МТ</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm tracking-wider uppercase text-white">
                GRANIT-NAVIGATOR v4.2 [МАРШРУТ {routeNumber} | БОРТ {vehicleId}]
              </span>
              <span className="bg-[#008058] text-[#d3ffe5] px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                КАМАЗ-6282 ЭЛЕКТРОБУС
              </span>
            </div>
            <span className="text-[10px] font-mono tracking-tight text-slate-400">
              ЕГПТС МОСГОРТРАНС • ФИЛИАЛ СЕВЕРО-ВОСТОЧНЫЙ • ПАРК 6 • ГОСНОМЕР Е 143 СК 777
            </span>
          </div>
        </div>

        {/* Telemetry Links & Driver ID */}
        <div className="flex items-center gap-2.5 font-mono text-xs">
          {/* Clock */}
          <div className="flex items-center gap-1.5 px-3 py-1 border border-slate-700 rounded-lg font-bold bg-[#141C2D] text-amber-400">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{liveClockStr} МСК</span>
          </div>

          {/* GLONASS / GPS */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-slate-700 rounded-lg text-[11px] font-bold bg-[#141C2D] text-emerald-400">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>ГЛОНАСС: 18 СПУТН.</span>
          </div>

          {/* 4G LTE / NDTP */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-slate-700 rounded-lg text-[11px] font-bold bg-[#141C2D] text-cyan-400">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span>NDTP :9201 [12мс]</span>
          </div>

          {/* Driver Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 border border-slate-700 rounded-lg text-[11px] bg-[#141C2D] text-slate-300">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>ТАБ. №08412 • ИВАНОВ А.В.</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN COCKPIT BODY (Split Grid: Left Route & Cab Telemetry, Right Directive & Holding Execution) */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
        {/* LEFT COLUMN: Route Schedule Horizon & Cab Subsystems (4 cols) */}
        <div className="col-span-4 flex flex-col gap-2.5 min-h-0">
          {/* Current Stop Box */}
          <div
            className="border-2 border-slate-700/80 rounded-xl p-3 shadow-md flex flex-col gap-1 shrink-0 bg-[#0F172A] text-white transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                ТЕКУЩИЙ ПУТЕВОЙ ОРИЕНТИР
              </span>
              <span className="px-1.5 py-0.2 bg-[#d32f2f] text-white rounded text-[9px] font-mono font-bold">
                МАРШРУТ {routeNumber}
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              ТЕКУЩАЯ ОСТАНОВКА (ОСТАНОВОЧНЫЙ КАРМАН):
            </span>
            <div className="text-lg font-black font-mono tracking-tight flex items-center gap-2 text-white">
              <span>МЕТРО БАУМАНСКАЯ</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              ➔ Направление: Серебряный бор ➔ Семёновская
            </span>
          </div>

          {/* Full Route Stops Schedule Progression (Filling space properly without empty voids) */}
          <div
            className={`flex-1 border-2 rounded-xl p-3 shadow-md flex flex-col justify-between overflow-hidden transition-colors min-h-0 ${
              isDark ? "bg-[#171f33] border-[#2d3449]" : "bg-white border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                ГОРИЗОНТ МАРШРУТА • ТАКТОВОЕ ОКНО
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                ЦЕЛЕВОЙ ТАКТ: 7.5 МИН
              </span>
            </div>

            <div className="flex flex-col gap-1.5 mt-2 overflow-y-auto">
              {/* Stop 13 (Passed) */}
              <div
                className={`p-2 rounded-lg border flex items-center justify-between opacity-70 ${
                  isDark ? "bg-[#0b1326] border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[9px] flex items-center justify-center">
                    13
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold line-through">ул. Покровка</span>
                    <span className="text-[9px] font-mono">Пройдена в 14:41:10</span>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-slate-400">В ГРАФИКЕ</span>
              </div>

              {/* Stop 14 (Active Holding Stop) */}
              <div
                className={`p-2.5 rounded-lg border-2 flex items-center justify-between shadow-sm ${
                  isDark
                    ? "bg-amber-500/10 border-amber-500"
                    : "bg-amber-50 border-amber-500"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#d32f2f] text-white font-bold text-xs flex items-center justify-center shadow">
                    14
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                        МЕТРО «БАУМАНСКАЯ»
                      </span>
                      <span className="px-1 py-0.2 bg-amber-500 text-black text-[9px] font-extrabold rounded">
                        ТЕКУЩАЯ
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                      РЕГУЛИРОВОЧНАЯ СТОЯНКА: {timerDisplay}
                    </span>
                  </div>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              </div>

              {/* Stop 15 */}
              <div
                className={`p-2 rounded-lg border flex items-center justify-between ${
                  isDark ? "bg-[#0b1326] border-[#2d3449]" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    15
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[11px] font-medium ${isDark ? "text-slate-300" : "text-slate-800"}`}>
                      Бакунинская ул., 84
                    </span>
                    <span className={`text-[9px] font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      Расчет: 14:51:00 (Такт восстанавливается)
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">Δ 7.5 МИН</span>
              </div>

              {/* Stop 16 */}
              <div
                className={`p-2 rounded-lg border flex items-center justify-between ${
                  isDark ? "bg-[#0b1326] border-[#2d3449]" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    16
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[11px] font-medium ${isDark ? "text-slate-300" : "text-slate-800"}`}>
                      м. Электрозаводская
                    </span>
                    <span className={`text-[9px] font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      Расчет: 14:54:30
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-slate-400">Δ 7.8 МИН</span>
              </div>

              {/* Stop 17 (Terminus) */}
              <div
                className={`p-2 rounded-lg border flex items-center justify-between ${
                  isDark ? "bg-[#0b1326] border-[#2d3449]" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    17
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[11px] font-medium ${isDark ? "text-slate-300" : "text-slate-800"}`}>
                      м. Семёновская (Конечная)
                    </span>
                    <span className={`text-[9px] font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      Расчет: 15:01:20
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-slate-400">---</span>
              </div>
            </div>

            {/* Passenger Load & NDTP Safety Interlocks */}
            <div className={`mt-2 pt-2 border-t flex flex-col gap-1.5 ${isDark ? "border-[#2d3449]" : "border-slate-200"}`}>
              {/* Passenger count (АСМПП) */}
              <div className="flex items-center justify-between text-[10px] font-mono px-1">
                <span className="text-slate-500 flex items-center gap-1">
                  <Users size={12} className="text-blue-500" />
                  <span>Пассажиропоток АСМПП:</span>
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  48 / 85 пасс. (56% мест)
                </span>
              </div>

              {/* Interlock Safety Strip */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`p-1.5 rounded border flex items-center gap-1.5 text-[10px] font-mono font-bold ${
                    isDark
                      ? "bg-[#0b1326] border-emerald-500/40 text-emerald-400"
                      : "bg-emerald-50 border-emerald-300 text-emerald-800"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>ХОД ЗАБЛОКИРОВАН [P]</span>
                </div>
                <div
                  className={`p-1.5 rounded border flex items-center gap-1.5 text-[10px] font-mono font-bold ${
                    secondsLeft > 0
                      ? isDark
                        ? "bg-[#0b1326] border-amber-500/40 text-amber-400"
                        : "bg-amber-50 border-amber-300 text-amber-800"
                      : isDark
                      ? "bg-[#0b1326] border-slate-700 text-slate-300"
                      : "bg-slate-50 border-slate-300 text-slate-700"
                  }`}
                >
                  {secondsLeft > 0 ? (
                    <DoorOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <DoorClosed className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                  <span>{secondsLeft > 0 ? "ПОСАДКА (ДВЕРИ ОТКР)" : "ДВЕРИ ЗАКРЫТЫ"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER/RIGHT COLUMN: Directive Callout & Big Action Box (8 cols) */}
        <div
          className={`col-span-8 flex flex-col justify-between border-2 border-amber-500 rounded-xl p-4 shadow-xl relative overflow-hidden transition-colors ${
            isDark ? "bg-[#171f33]" : "bg-white"
          }`}
        >
          {/* Top Header of Directive */}
          <div
            className={`flex items-start justify-between border-b-2 pb-2.5 ${
              isDark ? "border-[#2d3449]" : "border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h2
                  className={`text-lg font-black font-mono tracking-tight uppercase ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  ВНИМАНИЕ: РЕГУЛИРОВОЧНАЯ СТОЯНКА (HOLDING)
                </h2>
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                  ИДЕНТИФИКАТОР ДИРЕКТИВЫ: ЦОДД-АРД-2026-03-9941 • ПРИОРИТЕТ 1 (ОПЕРАТИВНЫЙ)
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="px-3 py-1 bg-red-600 text-white font-mono font-black text-xs rounded-lg animate-pulse shadow-sm">
                ТАКТ НАРУШЕН
              </span>
              <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                Основание: ML-предикт T+15 мин
              </span>
            </div>
          </div>

          {/* Central Countdown LED & Target Departure */}
          <div className="grid grid-cols-12 gap-3.5 py-1">
            {/* Massive LED Countdown Box */}
            <div
              className={`col-span-7 border-2 border-amber-500/80 rounded-2xl p-4 flex flex-col items-center justify-center shadow-inner ${
                isDark ? "bg-[#000000]" : "bg-slate-950 text-white"
              }`}
            >
              <div className="w-full flex items-center justify-between mb-1">
                <span className="text-[11px] font-mono font-bold text-amber-400 tracking-wider uppercase">
                  ОСТАЛОСЬ ВРЕМЕНИ СТОЯНКИ
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {progressPercent}% пройдено
                </span>
              </div>

              <div
                className={`text-6xl font-mono font-black tracking-tight leading-none drop-shadow-[0_0_20px_rgba(245,158,11,0.6)] ${
                  secondsLeft > 0 ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {secondsLeft > 0 ? timerDisplay : "00:00"}
              </div>

              {/* Visual Progress Bar of Holding */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-amber-500 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between w-full text-[10px] font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${secondsLeft > 0 ? "bg-amber-400 animate-ping" : "bg-emerald-400"}`} />
                  <span>{secondsLeft > 0 ? "ИДЕТ РЕГУЛИРОВОЧНАЯ СТОЯНКА" : "СТОЯНКА ЗАВЕРШЕНА"}</span>
                </div>
                <span>Норматив: 150 сек</span>
              </div>
            </div>

            {/* Target Departure & Passenger Info Box */}
            <div className="col-span-5 flex flex-col justify-between gap-2.5">
              <div
                className={`border-2 border-cyan-500/80 rounded-xl p-3 flex flex-col justify-center ${
                  isDark ? "bg-[#000000]" : "bg-cyan-950 text-white"
                }`}
              >
                <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  РАСЧЕТНОЕ ВРЕМЯ ОТПРАВЛЕНИЯ:
                </span>
                <span className="text-2xl font-mono font-black text-cyan-300 drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]">
                  {departureTimeStr} МСК
                </span>
                <span className="text-[9px] font-mono text-cyan-100/70 mt-0.5">
                  Синхронизировано по серверу АСУ-РДС с точностью 0.1 сек
                </span>
              </div>

              <div
                className={`border rounded-xl p-2.5 flex flex-col justify-center ${
                  isDark
                    ? "bg-[#060e20] border-[#2d3449]"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <Volume2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Салонный автоинформатор</span>
                </div>
                <span className={`text-[10px] mt-0.5 leading-snug ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Трансляция в салон: «Уважаемые пассажиры, технологическая регулировка интервала движения».
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Route Corridor Visualizer (Why are we holding?) */}
          <div
            className={`p-3 border rounded-xl flex flex-col gap-1.5 ${
              isDark ? "bg-[#060e20] border-[#2d3449]" : "bg-slate-50 border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-mono font-bold">
              <span className="text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
                <Navigation size={11} /> СХЕМА СИТУАЦИИ НА ПЕРЕГОНЕ «БАУМАНСКАЯ ➔ БАКУНИНСКАЯ»
              </span>
              <span className="text-slate-500">Дистанция до лидера: 480 м (Пачкование)</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div
                className={`p-2 rounded-lg border ${
                  isDark ? "bg-[#171f33] border-red-900/60 text-red-300" : "bg-red-50 border-red-200 text-red-900"
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <span>🚨 Борт №1042 (Впереди):</span>
                </div>
                <div className="text-[10px] mt-0.5 opacity-90">
                  Застрял в заторе на Бакунинской (14 км/ч). Опоздание +3.2 мин.
                </div>
              </div>

              <div
                className={`p-2 rounded-lg border ${
                  isDark ? "bg-[#171f33] border-emerald-900/60 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-900"
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <span>✅ Борт №1043 (Ваш борт):</span>
                </div>
                <div className="text-[10px] mt-0.5 opacity-90">
                  Стоит на Бауманской. Дает борт №1042 уехать ➔ такт восстановится до 7.5 мин.
                </div>
              </div>
            </div>
          </div>

          {/* Official Directive Description Box */}
          <div
            className={`p-2.5 border rounded-xl text-xs font-mono leading-relaxed ${
              isDark
                ? "bg-[#0b1326] border-[#2d3449] text-slate-300"
                : "bg-slate-50 border-slate-300 text-slate-700"
            }`}
          >
            <span className="font-bold text-amber-600 dark:text-amber-400">Директива Службы движения ЦОДД:</span> ликвидация
            пачкования с бортом <strong>№1042</strong>. Выравнивание такта линии м3 до <strong>7.5 мин</strong> по формуле Велдинга.
            Пассажирские табло остановок и салонный автоинформатор уведомлены.
          </div>

          {/* Huge Touch CTA Button */}
          <button
            onClick={handleAck}
            className={`w-full py-4 rounded-xl font-mono font-black text-base uppercase tracking-wider flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg ${
              isAcked
                ? "bg-[#008058] text-[#d3ffe5] border-2 border-[#6ffbbe]"
                : secondsLeft === 0
                ? "bg-blue-600 hover:bg-blue-500 text-white border-2 border-blue-400 active:scale-98 animate-pulse"
                : "bg-[#10b981] hover:bg-[#059669] text-white border-2 border-emerald-400 active:scale-98"
            }`}
          >
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <span>
              {isAcked
                ? `✓ КВИТИРОВАНО В ${ackTime} • КОМАНДА ПРИНЯТА К ИСПОЛНЕНИЮ`
                : secondsLeft === 0
                ? "✓ ВРЕМЯ СТОЯНКИ ИСТЕКЛО • ЗАКРЫТЬ ДВЕРИ И НАЧАТЬ ДВИЖЕНИЕ"
                : "✓ ПОДТВЕРДИТЬ ПРИЕМ И ВЫПОЛНЕНИЕ ДИРЕКТИВЫ"}
            </span>
          </button>
        </div>
      </div>

      {/* 3. BOTTOM TELEMETRY DOCK (NDTP Parameters: Speed, Headway, Battery, Pneumatics, Call) */}
      <footer className="grid grid-cols-12 gap-3 h-20 shrink-0 font-mono">
        {/* Speedometer */}
        <div className="col-span-2 border-2 rounded-xl p-2.5 flex flex-col justify-between bg-[#080E1C] border-slate-700/80 text-white shadow-md">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
            <span>СКОРОСТЬ</span>
            <span className="text-amber-400">[СТОЯНКА]</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white">0</span>
            <span className="text-xs text-slate-400">км/ч</span>
          </div>
          <span className="text-[9px] text-emerald-400 font-bold">✓ ручной тормоз [P]</span>
        </div>

        {/* Headway Back (Bunching alert) */}
        <div className="col-span-3 border-2 rounded-xl p-2.5 flex flex-col justify-between bg-[#080E1C] border-rose-600 text-white shadow-md">
          <div className="flex items-center justify-between text-[10px] text-rose-400 font-bold uppercase">
            <span>СЗАДИ: БОРТ #1042</span>
            <span className="bg-red-600 text-white px-1 rounded text-[9px]">СХЛОПЫВАНИЕ</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400">1.4 МИН</span>
            <span className="text-slate-400">➔</span>
            <span className="text-xl font-black text-emerald-400">7.5 МИН</span>
          </div>
          <span className="text-[9px] text-slate-400">Дистанция: 480 м (Пачкование ликвидируется)</span>
        </div>

        {/* Headway Front */}
        <div className="col-span-3 border-2 rounded-xl p-2.5 flex flex-col justify-between bg-[#080E1C] border-slate-700/80 text-white shadow-md">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
            <span>ВПЕРЕДИ: БОРТ #1041</span>
            <span className="text-emerald-400">● НОРМА</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-400">8.2</span>
            <span className="text-xs text-slate-400">МИН</span>
          </div>
          <span className="text-[9px] text-slate-400">Дистанция: 2.8 км (Штатный такт)</span>
        </div>

        {/* Battery SOC & Pneumatics */}
        <div className="col-span-2 border-2 rounded-xl p-2.5 flex flex-col justify-between bg-[#080E1C] border-slate-700/80 text-white shadow-md">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
            <span>ТЯГА (SOC)</span>
            <span className="text-emerald-400">142 КМ</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">84%</span>
            <span className="text-[10px] text-slate-400">650V</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-800">
            <div className="bg-emerald-500 h-full w-[84%]" />
          </div>
        </div>

        {/* Dispatcher Quick Touch Action */}
        <div className="col-span-2 border-2 rounded-xl p-2 flex flex-col justify-center items-center text-center cursor-pointer transition-all active:scale-95 shadow-md bg-[#171f33] border-slate-600 hover:border-slate-400 text-white">
          <PhoneCall className="w-5 h-5 text-amber-400 mb-1" />
          <span className="text-xs font-black uppercase tracking-tight text-white">
            ДИСПЕТЧЕР
          </span>
          <span className="text-[9px] text-slate-400">СЕКТОР «ЦЕНТР»</span>
        </div>
      </footer>
    </div>
  );
};

export default DriverTerminal;
