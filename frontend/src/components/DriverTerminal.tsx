import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  Radio,
  Wifi,
  PhoneCall,
  AlertTriangle,
  ShieldCheck,
  Volume2,
  Sun,
  Moon,
  User,
  Users,
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

  // Theme control: cab defaults to Daylight mode unless overridden
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
      className={`w-full h-full flex flex-col font-sans select-none overflow-y-auto p-2 lg:p-3 gap-2.5 transition-colors duration-200 ${
        isDark ? "bg-[#0b1326] text-[#dae2fd]" : "bg-[#eef2f6] text-slate-900"
      }`}
      data-purpose="cockpit-root"
    >
      {/* 1. TOP HARDWARE & TELEMETRY STATUS BAR */}
      <header
        className={`border rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm transition-colors shrink-0 ${
          isDark
            ? "bg-[#171f33] border-slate-700/80 text-white"
            : "bg-white border-[#dbe2ea] text-slate-900"
        }`}
        data-purpose="top-navigation-telemetry"
      >
        {/* Left: Transport Brand & Route Ident */}
        <div className="flex items-center gap-3">
          {/* Moscow Transport Brand Badge */}
          <div className="flex items-center gap-2 bg-[#d62828] text-white font-bold px-2.5 py-1 rounded text-xs tracking-wider shadow-sm">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <circle cx="12" cy="12" fill="none" r="10" stroke="currentColor" strokeWidth="2.5" />
              <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="#fff" strokeWidth="3" />
            </svg>
            <span>МОСКОВСКИЙ ТРАНСПОРТ</span>
            <span className="text-[10px] bg-red-950/40 px-1.5 py-0.5 rounded text-red-100 font-bold">ЦОДД</span>
          </div>

          {/* Terminal & Hardware Identity */}
          <div className={`flex items-center gap-2 border-l pl-3 ${isDark ? "border-slate-700" : "border-[#dbe2ea]"}`}>
            <span
              className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${
                isDark
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
              }`}
            >
              {routeNumber}
            </span>
            <div className="flex flex-col">
              <div className="text-xs font-bold flex items-center gap-2">
                <span className={isDark ? "text-white" : "text-slate-900"}>ГРАНИТ-НАВИГАТОР v4.2</span>
                <span className={`font-mono text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  • БОРТ {vehicleId} [КАМАЗ-6282]
                </span>
              </div>
              <div className={`text-[10px] font-mono tracking-tight font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                ЕГПТС МОСГОРТРАНС • ФИЛИАЛ СЕВЕРО-ВОСТОЧНЫЙ • ПАРК 6 • Е 143 СК 777
              </div>
            </div>
          </div>
        </div>

        {/* Center: System Telemetry Status Badges */}
        <div className="hidden xl:flex items-center gap-2.5 font-mono text-xs">
          {/* Clock & Sync Status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded shadow-sm border ${
              isDark
                ? "bg-[#0b1326] border-amber-600/40 text-amber-300"
                : "bg-[#f8fafc] border-amber-300/80 text-amber-900"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-bold tracking-wider">{liveClockStr}</span>
            <span className="text-[10px] opacity-75 font-medium">МСК (UTC+3)</span>
          </div>

          {/* GLONASS */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded shadow-sm border ${
              isDark
                ? "bg-[#0b1326] border-slate-700 text-slate-300"
                : "bg-[#f8fafc] border-[#dbe2ea] text-slate-700"
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-sky-600" />
            <span>
              ГЛОНАСС: <strong className={isDark ? "text-white" : "text-slate-900"}>18 СПУТН.</strong>
            </span>
          </div>

          {/* Protocol & Network Latency */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded shadow-sm border ${
              isDark
                ? "bg-[#0b1326] border-slate-700 text-slate-300"
                : "bg-[#f8fafc] border-[#dbe2ea] text-slate-700"
            }`}
          >
            <span className="text-sky-700 font-bold">NDTP :9201</span>
            <span
              className={`text-[10px] border px-1 rounded font-bold ${
                isDark
                  ? "bg-sky-950 text-sky-300 border-sky-700"
                  : "bg-sky-100 text-sky-800 border-sky-300"
              }`}
            >
              12 мс
            </span>
          </div>

          {/* Regularity Takt Quality Factor */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded shadow-sm border ${
              isDark
                ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                : "bg-emerald-50 border-emerald-300 text-emerald-800"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-bold">96.2% ТАКТ</span>
          </div>

          {/* Failures / Incidents */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded shadow-sm border ${
              isDark
                ? "bg-[#0b1326] border-slate-700 text-slate-300"
                : "bg-[#f8fafc] border-[#dbe2ea] text-slate-700"
            }`}
          >
            <span className={isDark ? "text-slate-400" : "text-slate-500"}>Сбои:</span>
            <span className="text-emerald-600 font-bold">0</span>
          </div>
        </div>

        {/* Right: Driver Info & Cockpit Mode Controls */}
        <div className="flex items-center gap-2">
          {/* Driver Identity */}
          <div
            className={`flex items-center gap-2 px-2.5 py-1 rounded text-xs shadow-sm border ${
              isDark
                ? "bg-[#0b1326] border-slate-700 text-slate-300"
                : "bg-[#f8fafc] border-[#dbe2ea] text-slate-700"
            }`}
          >
            <User className="w-3.5 h-3.5 text-slate-400" />
            <div className="text-left leading-tight">
              <div className="text-[10px] text-slate-400 font-mono font-medium">ТАБ. №08412</div>
              <div className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Иванов А.В.</div>
            </div>
          </div>

          {/* Reset Demo & Day/Night Toggle */}
          <div className={`flex items-center rounded p-0.5 border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"}`}>
            <button
              onClick={handleResetDemo}
              className={`px-2.5 py-1 text-xs rounded font-medium border flex items-center gap-1 transition-colors cursor-pointer shadow-sm ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300"
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
              }`}
              title="Сбросить таймер стоянки на 150 сек для повторной демонстрации"
            >
              <RotateCcw size={10} />
              <span className="text-[11px] font-mono">150с</span>
            </button>
            <button
              onClick={() => setInternalDarkMode(!internalDarkMode)}
              className={`px-2.5 py-1 text-xs rounded font-bold border flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ml-1 ${
                !isDark
                  ? "bg-white text-slate-900 border-slate-200"
                  : "bg-slate-800 text-amber-300 border-slate-600"
              }`}
              title="Переключить День/Ночь"
            >
              {isDark ? <Moon size={12} className="text-amber-400" /> : <Sun size={12} className="text-amber-500" />}
              <span className="text-[11px]">{isDark ? "Ночь" : "День"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN COCKPIT BODY (Split Grid: Left Route & Cab Telemetry, Right Directive & Holding Execution) */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1" data-purpose="primary-cockpit-layout">
        {/* BEGIN: LeftColumnRoute (4 cols) */}
        <section className="lg:col-span-4 flex flex-col gap-2.5" data-purpose="route-status-panel">
          {/* Current Stop Guidance Card */}
          <div
            className={`border rounded-lg p-3 relative overflow-hidden shadow-sm transition-colors ${
              isDark ? "bg-[#171f33] border-slate-700" : "bg-white border-[#dbe2ea]"
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-2 mb-2.5 ${isDark ? "border-slate-700" : "border-[#e2e8f0]"}`}>
              <div className="text-[10px] font-mono tracking-wider text-amber-700 font-bold flex items-center gap-1.5 uppercase">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Текущий путевой ориентир
              </div>
              <div className="text-[10px] bg-red-100 border border-red-300 text-red-800 px-2 py-0.5 rounded font-mono font-bold">
                ОСТАНОВОЧНЫЙ КАРМАН
              </div>
            </div>
            <h1 className={`text-xl font-extrabold tracking-tight mb-1 uppercase font-sans ${isDark ? "text-white" : "text-slate-900"}`}>
              Метро «Бауманская»
            </h1>
            <div className={`text-xs flex items-center gap-1.5 font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">Направление: Серебряный бор → Семёновская</span>
            </div>
          </div>

          {/* Route Horizon Timeline Card */}
          <div
            className={`border rounded-lg p-3 flex-1 flex flex-col shadow-sm transition-colors ${
              isDark ? "bg-[#171f33] border-slate-700" : "bg-white border-[#dbe2ea]"
            }`}
            data-purpose="route-horizon"
          >
            <div className={`flex items-center justify-between text-xs mb-3 pb-2 border-b ${isDark ? "border-slate-700" : "border-[#e2e8f0]"}`}>
              <span className={`font-bold uppercase tracking-wide text-[11px] ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                Горизонт маршрута
              </span>
              <span className="font-mono text-emerald-800 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                Целевой такт: 7.5 мин
              </span>
            </div>

            {/* Vertical Timeline Stops */}
            <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scroll max-h-[380px] lg:max-h-none">
              {/* Stop 13: Past Stop */}
              <div
                className={`flex items-center justify-between p-2 rounded border opacity-75 ${
                  isDark ? "bg-[#0b1326] border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-400"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded bg-slate-200 text-slate-600 font-mono text-xs flex items-center justify-center font-bold">
                    13
                  </span>
                  <div>
                    <div className="text-xs font-semibold line-through text-slate-500">ул. Покровка</div>
                    <div className="text-[10px] font-mono text-slate-400">Пройдена в 14:41:10</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded font-medium">
                  В ГРАФИКЕ
                </span>
              </div>

              {/* Stop 14: ACTIVE REGULATORY HOLDING (CURRENT) */}
              <div
                className={`flex items-center justify-between p-2.5 rounded-lg border-2 relative shadow-sm ${
                  isDark
                    ? "bg-amber-950/40 border-amber-500 text-white"
                    : "bg-amber-50 border-amber-500 text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded bg-amber-500 text-white font-mono text-xs flex items-center justify-center font-black animate-pulse shadow-sm">
                    14
                  </span>
                  <div>
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <span className={isDark ? "text-amber-200" : "text-amber-950"}>МЕТРО «БАУМАНСКАЯ»</span>
                      <span className="bg-amber-200 text-amber-900 text-[9px] font-mono px-1.5 py-0.2 rounded font-bold border border-amber-300">
                        ТЕКУЩАЯ
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-amber-800 font-bold mt-0.5">
                      РЕГУЛИРОВОЧНАЯ СТОЯНКА:{" "}
                      <span className={`font-extrabold ${isDark ? "text-white" : "text-amber-950"}`}>
                        {timerDisplay}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-200" />
              </div>

              {/* Stop 15: Ahead */}
              <div
                className={`flex items-center justify-between p-2 rounded border ${
                  isDark
                    ? "bg-[#0b1326] border-slate-800 text-slate-300"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded bg-slate-200 text-slate-800 font-mono text-xs flex items-center justify-center font-bold">
                    15
                  </span>
                  <div>
                    <div className={`text-xs font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      Бакунинская ул., 84
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      Расчет: 14:51:00 (Такт восстанавливается)
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Δ 7.5 МИН
                </span>
              </div>

              {/* Stop 16: Ahead */}
              <div
                className={`flex items-center justify-between p-2 rounded border ${
                  isDark
                    ? "bg-[#0b1326] border-slate-800 text-slate-300"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded bg-slate-200 text-slate-800 font-mono text-xs flex items-center justify-center font-bold">
                    16
                  </span>
                  <div>
                    <div className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      м. Электрозаводская
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">Расчет: 14:54:30</div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-600 font-medium">Δ 7.8 МИН</span>
              </div>

              {/* Stop 17: Destination */}
              <div
                className={`flex items-center justify-between p-2 rounded border ${
                  isDark
                    ? "bg-[#0b1326] border-slate-800 text-slate-400"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded bg-slate-200 text-slate-500 font-mono text-xs flex items-center justify-center font-bold">
                    17
                  </span>
                  <div>
                    <div className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      м. Семёновская (Конечная)
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">Расчет: 15:01:20</div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400 font-medium">— —</span>
              </div>
            </div>

            {/* Passenger Count & Door Interlock Status */}
            <div className={`mt-3 pt-2.5 border-t grid grid-cols-2 gap-2 text-xs ${isDark ? "border-slate-700" : "border-[#e2e8f0]"}`}>
              <div
                className={`border rounded p-2 shadow-sm ${
                  isDark
                    ? "bg-[#0b1326] border-slate-800 text-slate-300"
                    : "bg-slate-50 border-[#dbe2ea] text-slate-700"
                }`}
              >
                <div className="text-[10px] text-slate-500 font-mono font-bold flex items-center gap-1">
                  <Users className="w-3 h-3 text-sky-600" />
                  АСМПП САЛОН
                </div>
                <div className={`font-mono text-sm font-black mt-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                  48 <span className="text-slate-500 text-xs font-normal">/ 85 пасс.</span>
                </div>
                <div className="text-[10px] text-emerald-700 font-mono font-semibold">
                  56% номинал (комфорт)
                </div>
              </div>

              <div
                className={`border rounded p-2 flex flex-col justify-between shadow-sm ${
                  isDark
                    ? "bg-[#0b1326] border-slate-800 text-slate-300"
                    : "bg-slate-50 border-[#dbe2ea] text-slate-700"
                }`}
              >
                <div className="text-[10px] text-slate-500 font-mono font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  БЛОКИРОВКИ ТС
                </div>
                <div className="text-xs font-mono font-extrabold text-amber-700">
                  ХОД ЗАБЛОКИРОВАН [P]
                </div>
                <div className="text-[10px] text-slate-500 font-mono font-medium">
                  {secondsLeft > 0 ? "ДВЕРИ: РАЗРЕШЕНО (ОТКР.)" : "ДВЕРИ: ЗАКРЫТЫ"}
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* END: LeftColumnRoute */}

        {/* BEGIN: CenterRightStage (8 cols) */}
        <section className="lg:col-span-8 flex flex-col gap-2.5" data-purpose="holding-central-stage">
          {/* Holding Alert Directive Header Banner */}
          <div
            className={`border-2 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 shadow-sm ${
              isDark
                ? "bg-amber-950/40 border-amber-600"
                : "bg-amber-50/90 border-amber-400"
            }`}
            data-purpose="directive-header"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded border flex items-center justify-center shrink-0 shadow-inner ${
                  isDark
                    ? "bg-amber-900/60 border-amber-700"
                    : "bg-amber-100 border-amber-300"
                }`}
              >
                <AlertTriangle className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    className={`text-base font-extrabold tracking-wide uppercase font-sans ${
                      isDark ? "text-amber-200" : "text-amber-950"
                    }`}
                  >
                    Внимание: Регулировочная стоянка (Holding)
                  </h2>
                  <span className="bg-amber-200/80 text-amber-900 border border-amber-400 text-[10px] font-mono px-2 py-0.5 rounded font-extrabold">
                    ПРИОРИТЕТ 1 (ОПЕРАТИВНЫЙ)
                  </span>
                </div>
                <div className="text-xs text-amber-900 font-mono mt-0.5 font-medium">
                  Идентификатор директивы:{" "}
                  <strong className={isDark ? "text-amber-100" : "text-amber-950"}>ЦОДД-АРД-2026-03-9941</strong> • Основание:
                  ML-предикт пачкования T+15 мин
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-[10px] font-mono uppercase block font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                АСУ-РДС Автоматика
              </span>
              <span className="text-xs font-mono text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded font-bold inline-block">
                ВЕРИФИЦИРОВАНО
              </span>
            </div>
          </div>

          {/* Main Display: Large High-Legibility Timer & Operational Dispatch Sync */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            {/* Master Countdown Timer (7 cols) */}
            <div
              className={`md:col-span-7 border rounded-lg p-4 flex flex-col justify-between relative shadow-sm transition-colors ${
                isDark ? "bg-[#171f33] border-amber-700" : "bg-white border-amber-300"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-amber-900 font-bold tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  ОСТАЛОСЬ ВРЕМЕНИ СТОЯНКИ
                </span>
                <span className="text-slate-500 text-[11px] font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                  Норматив: 150 сек
                </span>
              </div>

              {/* Massive Digits in Daylight Aviation Amber (Anti-Glare & Maximum Sunlight Contrast) */}
              <div className="py-4 text-center">
                <div className="text-6xl sm:text-7xl font-mono font-extrabold tracking-tight text-amber-600 glow-amber font-digital drop-shadow-sm leading-none">
                  {secondsLeft > 0 ? timerDisplay : "00:00"}
                </div>
                <div className="text-xs font-mono uppercase tracking-widest text-slate-600 font-bold mt-2 flex items-center justify-center gap-2">
                  <span className="w-2.5 h-0.5 bg-amber-400" />
                  {secondsLeft > 0 ? "ИДЁТ ТЕХНОЛОГИЧЕСКАЯ РЕГУЛИРОВОЧНАЯ СТОЯНКА" : "СТОЯНКА ЗАВЕРШЕНА"}
                  <span className="w-2.5 h-0.5 bg-amber-400" />
                </div>
              </div>

              {/* Holding Progress Bar */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-600 mb-1 font-semibold">
                  <span>Прогресс выдержки интервала</span>
                  <span className="text-amber-700 font-bold">{progressPercent}% пройдено</span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 border border-slate-300 rounded overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-sm shadow-sm transition-all duration-1000 ease-linear"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Calculated Target Departure & Passenger PA status (5 cols) */}
            <div className="md:col-span-5 flex flex-col gap-2.5">
              {/* Departure target */}
              <div
                className={`border rounded-lg p-3.5 flex-1 flex flex-col justify-center shadow-sm transition-colors ${
                  isDark ? "bg-[#171f33] border-slate-700" : "bg-white border-[#dbe2ea]"
                }`}
              >
                <div className="text-[11px] font-mono text-sky-700 font-bold flex items-center gap-1.5 mb-1 uppercase">
                  <Clock className="w-4 h-4 text-sky-600" />
                  Расчетное время отправления
                </div>
                <div className={`text-3xl font-mono font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {departureTimeStr} <span className="text-sm font-semibold text-slate-500">МСК</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 font-medium">
                  Синхронизировано по серверу АСУ-РДС с точностью ±0.1 сек
                </div>
              </div>

              {/* Audio Informer Status */}
              <div
                className={`border rounded-lg p-3 flex-1 flex flex-col justify-center shadow-sm transition-colors ${
                  isDark ? "bg-[#171f33] border-slate-700" : "bg-white border-[#dbe2ea]"
                }`}
              >
                <div className={`text-[11px] font-mono font-bold flex items-center gap-1.5 mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  Салонный автоинформатор
                </div>
                <div
                  className={`text-xs italic border-l-2 border-emerald-600 pl-2.5 py-0.5 rounded-r ${
                    isDark ? "bg-emerald-950/40 text-slate-200" : "bg-emerald-50/50 text-slate-800"
                  }`}
                >
                  «Уважаемые пассажиры, технологическая регулировка интервала движения».
                </div>
                <div className="text-[10px] text-emerald-700 font-mono mt-1 font-bold">
                  ✓ Сообщение успешно транслировано в салон
                </div>
              </div>
            </div>
          </div>

          {/* Situational Scheme Diagram (Схема ситуации на перегоне) */}
          <div
            className={`border rounded-lg p-3 shadow-sm transition-colors ${
              isDark ? "bg-[#171f33] border-slate-700" : "bg-white border-[#dbe2ea]"
            }`}
            data-purpose="situational-diagram"
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-mono text-amber-800 font-bold uppercase flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-amber-600" />
                Схема ситуации: перегон «Бауманская → Бакунинская»
              </span>
              <span className="text-[11px] font-mono text-slate-600 font-medium">
                Дистанция до лидера:{" "}
                <strong className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>480 м</strong> (Пачкование)
              </span>
            </div>

            {/* Visual schematic split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {/* Leader Bus */}
              <div className="bg-amber-50/70 border border-amber-300 rounded p-2.5 flex items-start gap-2.5 shadow-sm">
                <div className="w-7 h-7 rounded bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 text-xs font-mono font-black border border-amber-300">
                  1042
                </div>
                <div className="text-xs">
                  <div className="font-bold text-amber-950 flex items-center gap-1.5">
                    <span>Борт №1042 (Впереди)</span>
                    <span className="text-[10px] font-mono text-amber-900 bg-amber-200 px-1.5 py-0.2 rounded font-bold border border-amber-300">
                      +3.2 мин
                    </span>
                  </div>
                  <div className="text-slate-700 text-[11px] mt-0.5">
                    Застрял в заторе на Бакунинской (скорость 14 км/ч). Создал разрыв интервала.
                  </div>
                </div>
              </div>

              {/* Current Bus Status */}
              <div className="bg-emerald-50/70 border border-emerald-300 rounded p-2.5 flex items-start gap-2.5 shadow-sm">
                <div className="w-7 h-7 rounded bg-emerald-200 text-emerald-900 flex items-center justify-center shrink-0 text-xs font-mono font-black border border-emerald-300">
                  1043
                </div>
                <div className="text-xs">
                  <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <span>Борт №1043 (Ваш борт)</span>
                    <span className="text-[10px] font-mono text-emerald-900 bg-emerald-200 px-1.5 py-0.2 rounded font-bold border border-emerald-300">
                      В ХОЛДИНГЕ
                    </span>
                  </div>
                  <div className="text-slate-700 text-[11px] mt-0.5">
                    Стоит на Бауманской. Дает уехать лидеру → такт линии восстановится до 7.5 мин.
                  </div>
                </div>
              </div>
            </div>

            {/* Mathematical formula / Dispatch order justification */}
            <div className={`mt-2.5 pt-2 border-t text-[11px] font-mono ${isDark ? "border-slate-700 text-slate-300" : "border-[#e2e8f0] text-slate-700"}`}>
              <span className="text-amber-800 font-bold">Директива Службы движения ЦОДД:</span>{" "}
              ликвидация пачкования с бортом №1042. Выравнивание такта линии м3 до 7.5 мин по алгоритму Велдинга.
              Пассажирские табло остановок оповещены.
            </div>
          </div>

          {/* Massive Ergonomic Confirm Action Button (Квитирование) */}
          <div className="mt-auto pt-1" data-purpose="acknowledge-button-wrapper">
            <button
              onClick={handleAck}
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-700 hover:to-emerald-800 text-white font-extrabold rounded-lg flex items-center justify-center gap-3 shadow-md glow-emerald transition transform active:scale-[0.99] cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm sm:text-base font-extrabold tracking-wider uppercase font-mono text-white">
                {isAcked
                  ? `Квитировано в ${ackTime || "23:59:24"} • Команда принята к исполнению`
                  : secondsLeft === 0
                  ? "Время стоянки истекло • Закрыть двери и начать движение"
                  : "Подтвердить прием и выполнение директивы"}
              </span>
            </button>
          </div>
        </section>
        {/* END: CenterRightStage */}
      </main>

      {/* 3. BOTTOM TELEMETRY SHELF (Speed, Headway Ahead/Behind, Traction SOC, Emergency Voice) */}
      <footer className="grid grid-cols-2 md:grid-cols-5 gap-2.5 shrink-0" data-purpose="cockpit-hardware-shelf">
        {/* Speedometer & Handbrake Status */}
        <div
          className={`border rounded-lg p-2.5 flex items-center gap-3 shadow-sm transition-colors ${
            isDark ? "bg-[#171f33] border-slate-700" : "bg-white border-[#dbe2ea]"
          }`}
        >
          <div
            className={`w-12 h-12 rounded border flex flex-col items-center justify-center ${
              isDark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
            }`}
          >
            <span className={`font-mono text-xl font-black leading-none ${isDark ? "text-white" : "text-slate-900"}`}>
              0
            </span>
            <span className="text-[9px] font-mono text-slate-500 font-bold">КМ/Ч</span>
          </div>
          <div className="text-xs">
            <div className="text-slate-500 font-mono text-[10px] font-bold uppercase">СКОРОСТЬ ТС</div>
            <div className="font-mono font-bold text-amber-700 flex items-center gap-1 text-[11px]">
              <span>✓ РУЧНОЙ ТОРМОЗ [P]</span>
            </div>
            <div className="text-[9px] text-slate-500 font-mono font-medium">СТОЯНКА АКТИВНА</div>
          </div>
        </div>

        {/* Spacing Behind (Схлопывание сзади) */}
        <div
          className={`border rounded-lg p-2.5 flex flex-col justify-between shadow-sm transition-colors ${
            isDark ? "bg-[#171f33] border-rose-900" : "bg-white border-rose-200"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className={`font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>СЗАДИ: БОРТ #1042</span>
            <span className="text-rose-700 font-bold bg-rose-100 border border-rose-300 px-1.5 rounded">
              СХЛОПЫВАНИЕ
            </span>
          </div>
          <div className={`text-sm font-mono font-bold flex items-center gap-1.5 my-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>
            <span className="text-rose-600 font-black text-base">1.4 мин</span>
            <span className="text-slate-400 text-xs">→</span>
            <span className="text-emerald-700 font-black text-base">7.5 мин</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate font-medium">Дистанция 480 м (устраняется)</div>
        </div>

        {/* Spacing Ahead (Штатный такт впереди) */}
        <div
          className={`border rounded-lg p-2.5 flex flex-col justify-between shadow-sm transition-colors ${
            isDark ? "bg-[#171f33] border-emerald-900" : "bg-white border-emerald-200"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className={`font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>ВПЕРЕДИ: БОРТ #1041</span>
            <span className="text-emerald-800 font-bold bg-emerald-100 border border-emerald-300 px-1.5 rounded">
              НОРМА
            </span>
          </div>
          <div className="text-base font-mono font-black text-emerald-700 my-0.5">8.2 мин</div>
          <div className="text-[10px] text-slate-500 font-mono font-medium">Дистанция: 2.8 км (Штатный такт)</div>
        </div>

        {/* High Voltage Battery SOC */}
        <div
          className={`border rounded-lg p-2.5 flex flex-col justify-between shadow-sm transition-colors ${
            isDark ? "bg-[#171f33] border-slate-700" : "bg-white border-[#dbe2ea]"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className={`font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>ТЯГА (SOC) • 650V</span>
            <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>142 КМ</span>
          </div>
          <div className="flex items-center gap-2 my-0.5">
            <span className={`font-mono text-xl font-black leading-none ${isDark ? "text-white" : "text-slate-900"}`}>
              84%
            </span>
            <div className="flex-1 h-2.5 bg-slate-100 border border-slate-300 rounded overflow-hidden p-0.5">
              <div className="h-full bg-emerald-600 rounded-sm" style={{ width: "84%" }} />
            </div>
          </div>
          <div className="text-[10px] text-emerald-800 font-mono font-semibold">
            Батарея в оптимуме (+28°C)
          </div>
        </div>

        {/* Dispatcher Voice Call Button */}
        <button className="col-span-2 md:col-span-1 bg-amber-50 hover:bg-amber-100 border-2 border-amber-400 hover:border-amber-500 rounded-lg p-2.5 flex items-center justify-center gap-2.5 text-amber-900 transition cursor-pointer group shadow-sm">
          <div className="w-8 h-8 rounded-full bg-amber-200 group-hover:bg-amber-300 flex items-center justify-center shrink-0 border border-amber-400">
            <PhoneCall className="w-4 h-4 text-amber-800" />
          </div>
          <div className="text-left font-mono leading-tight">
            <div className="text-xs font-black text-amber-950 uppercase">Диспетчер</div>
            <div className="text-[10px] text-amber-800 font-bold">Сектор «Центр»</div>
          </div>
        </button>
      </footer>

      {/* 4. DESIGN SYSTEM STANDARDS LEGEND FOOTNOTE */}
      <aside
        className={`border rounded-lg p-2 text-[11px] flex flex-wrap items-center justify-between gap-3 font-mono shadow-sm shrink-0 transition-colors ${
          isDark ? "bg-[#171f33] border-slate-700 text-slate-400" : "bg-white border-[#dbe2ea] text-slate-600"
        }`}
        data-purpose="design-system-standards"
      >
        <div className={`flex items-center gap-2 font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>ДНЕВНОЙ РЕЖИМ КАБИНЫ (ISO 9241-391 &amp; ГОСТ Р ИСО 15005 / SAE J1757):</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[#eef2f6] border border-slate-300" />
            <span>
              <strong>Дымчатая платина (#eef2f6)</strong>: антиблик без ослепления
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-500" />
            <span>
              <strong>Авиационный янтарь (#d97706)</strong>: эргономичный фокус внимания
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-600" />
            <span>
              <strong>Транспортный изумруд (#059669)</strong>: стабильность и норматив
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-slate-900" />
            <span>
              <strong>Графит Slate-900 (WCAG AAA)</strong>: читаемость под прямым солнцем
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default DriverTerminal;
