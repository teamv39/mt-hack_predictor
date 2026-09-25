import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  PhoneCall,
  AlertTriangle,
  Volume2,
  Users,
  RotateCcw,
  ArrowRight,
  Shield,
  Gauge,
  Zap,
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
  isDarkMode = false,
}) => {
  const initialPrefs = useMemo(() => loadPreferences(), []);

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

  // Calculated seconds remaining
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

  // Calculated Target Departure Time String
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
      className={`w-full h-full flex flex-col font-sans select-none overflow-y-auto p-3 lg:p-4 gap-3 transition-colors duration-200 ${
        isDarkMode ? "bg-[#121214] text-zinc-100" : "bg-[#f4f5f8] text-zinc-900"
      }`}
      data-purpose="driver-terminal-root"
    >
      {/* 1. DIRECTIVE HEADER BANNER */}
      <header
        className={`rounded-2xl p-3.5 sm:p-4 border transition-colors flex flex-wrap items-center justify-between gap-3 shadow-xs ${
          isDarkMode
            ? "bg-[#18181b] border-amber-500/40"
            : "bg-amber-50/80 border-amber-300"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${
              isDarkMode
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : "bg-amber-100 border-amber-300 text-amber-700"
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black tracking-tight">
                Регулировочная стоянка (Холдинг)
              </h1>
              <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${
                isDarkMode
                  ? "bg-amber-400/10 text-amber-300 border-amber-400/30"
                  : "bg-amber-200 text-amber-900 border-amber-300"
              }`}>
                {routeNumber.toUpperCase()} • БОРТ {vehicleId}
              </span>
            </div>
            <p className={`text-xs mt-0.5 font-medium ${isDarkMode ? "text-zinc-400" : "text-zinc-600"}`}>
              Остановка «Метро Бауманская» • Устранение пачкования, выравнивание такта до 7.5 мин
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDemo}
            className={`px-2.5 py-1.5 text-xs rounded-xl font-semibold border flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
              isDarkMode
                ? "bg-[#222226] hover:bg-[#2b2b30] border-zinc-700 text-zinc-300"
                : "bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700"
            }`}
            title="Сбросить таймер на 150 с (для демонстрации)"
          >
            <RotateCcw size={12} />
            <span className="font-mono text-xs">150 с</span>
          </button>

          <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 font-mono ${
            isDarkMode
              ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-400"
              : "bg-emerald-50 border-emerald-300 text-emerald-800"
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>ЦОДД АСУ-РДС</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN COCKPIT BODY */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Left Column: Route Stops (4 cols) */}
        <section
          className={`lg:col-span-4 rounded-2xl border p-4 flex flex-col justify-between shadow-xs transition-colors ${
            isDarkMode ? "bg-[#18181b] border-zinc-800" : "bg-white border-zinc-200"
          }`}
        >
          <div>
            <div className={`flex items-center justify-between pb-3 border-b mb-3 ${
              isDarkMode ? "border-zinc-800" : "border-zinc-100"
            }`}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Маршрут {routeNumber}
                </span>
              </div>
              <span className={`text-[11px] font-mono font-medium ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>
                Такт: 7.5 мин
              </span>
            </div>

            {/* Vertical Stops Timeline */}
            <div className="space-y-2">
              {/* Past Stop */}
              <div className={`flex items-center justify-between p-2.5 rounded-xl border opacity-60 ${
                isDarkMode ? "bg-[#121214] border-zinc-800/80 text-zinc-500" : "bg-zinc-50 border-zinc-200 text-zinc-500"
              }`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-zinc-400/20 text-xs font-mono font-bold flex items-center justify-center">
                    13
                  </span>
                  <div>
                    <div className="text-xs font-medium line-through">ул. Покровка</div>
                    <div className="text-[10px] font-mono">Пройдена в 14:41</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono">ПРОЙДЕНО</span>
              </div>

              {/* CURRENT STOP - IN HOLDING */}
              <div className={`flex items-center justify-between p-3 rounded-xl border-2 shadow-xs ${
                isDarkMode
                  ? "bg-amber-950/20 border-amber-500 text-amber-200"
                  : "bg-amber-50/80 border-amber-500 text-amber-950"
              }`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-mono font-black flex items-center justify-center shadow-xs">
                    14
                  </span>
                  <div>
                    <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
                      <span>М. «БАУМАНСКАЯ»</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded font-bold bg-amber-400/30 border border-amber-400/40">
                        ТЕКУЩАЯ
                      </span>
                    </div>
                    <div className="text-[11px] font-mono font-bold mt-0.5">
                      {secondsLeft > 0 ? `Стоянка: ${timerDisplay}` : "Стоянка завершена"}
                    </div>
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              </div>

              {/* Next Stops */}
              <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
                isDarkMode ? "bg-[#121214] border-zinc-800 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-700"
              }`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-xs font-mono font-bold flex items-center justify-center">
                    15
                  </span>
                  <div>
                    <div className="text-xs font-medium">Бакунинская ул., 84</div>
                    <div className={`text-[10px] font-mono ${isDarkMode ? "text-zinc-500" : "text-zinc-400"}`}>
                      Расчетное: 14:51:00
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-bold ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}>
                  Δ 7.5 МИН
                </span>
              </div>

              <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
                isDarkMode ? "bg-[#121214] border-zinc-800 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-700"
              }`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-xs font-mono font-bold flex items-center justify-center">
                    16
                  </span>
                  <div>
                    <div className="text-xs font-medium">м. Электрозаводская</div>
                    <div className={`text-[10px] font-mono ${isDarkMode ? "text-zinc-500" : "text-zinc-400"}`}>
                      Расчетное: 14:54:30
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] font-mono ${isDarkMode ? "text-zinc-500" : "text-zinc-400"}`}>
                  Δ 7.8 мин
                </span>
              </div>
            </div>
          </div>

          {/* Passenger Cabin Telemetry Card */}
          <div className={`mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs ${
            isDarkMode ? "border-zinc-800" : "border-zinc-100"
          }`}>
            <div className={`p-2.5 rounded-xl border ${
              isDarkMode ? "bg-[#121214] border-zinc-800" : "bg-zinc-50 border-zinc-200"
            }`}>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-medium">
                <Users size={12} className="text-blue-500" />
                <span>Салон АСМПП</span>
              </div>
              <div className="font-mono text-sm font-bold mt-1">
                48 <span className="text-xs text-zinc-500 font-normal">/ 85 пасс.</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-medium mt-0.5">56% (свободно)</div>
            </div>

            <div className={`p-2.5 rounded-xl border ${
              isDarkMode ? "bg-[#121214] border-zinc-800" : "bg-zinc-50 border-zinc-200"
            }`}>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-medium">
                <Shield size={12} className="text-amber-500" />
                <span>Двери ТС</span>
              </div>
              <div className="font-mono text-xs font-bold text-amber-600 mt-1">
                {secondsLeft > 0 ? "ПОСАДКА РАЗРЕШЕНА" : "ДВЕРИ ЗАКРЫТЫ"}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                Стояночный [P] активен
              </div>
            </div>
          </div>
        </section>

        {/* Right Stage: Holding Timer & Action Execution (8 cols) */}
        <section className="lg:col-span-8 flex flex-col gap-3">
          {/* Main Holding Display Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Big Countdown Timer Card (7 cols) */}
            <div
              className={`md:col-span-7 rounded-2xl border p-5 flex flex-col justify-between shadow-xs transition-colors ${
                isDarkMode ? "bg-[#18181b] border-amber-500/40" : "bg-white border-amber-300"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-amber-600 font-bold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  ВРЕМЯ СТОЯНКИ
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                  isDarkMode ? "bg-[#222226] text-zinc-400" : "bg-zinc-100 text-zinc-600"
                }`}>
                  Норма: 150 с
                </span>
              </div>

              {/* Massive Countdown Digits */}
              <div className="py-4 text-center">
                <div className="text-6xl sm:text-7xl font-mono font-black tracking-tight text-amber-500 font-digital leading-none">
                  {secondsLeft > 0 ? timerDisplay : "00:00"}
                </div>
                <p className={`text-xs font-mono uppercase tracking-wider font-bold mt-2.5 ${
                  secondsLeft > 0 ? "text-amber-600" : "text-emerald-600"
                }`}>
                  {secondsLeft > 0 ? "Идёт технологическая выдержка такта" : "Стоянка завершена • Начать движение"}
                </p>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-zinc-500 mb-1.5">
                  <span>Выдержка интервала</span>
                  <span className="font-bold text-amber-600">{progressPercent}%</span>
                </div>
                <div className={`w-full h-3 rounded-full overflow-hidden p-0.5 border ${
                  isDarkMode ? "bg-[#121214] border-zinc-700" : "bg-zinc-100 border-zinc-200"
                }`}>
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Departure Target & Passenger Informer Card (5 cols) */}
            <div className="md:col-span-5 flex flex-col gap-3">
              {/* Departure target */}
              <div
                className={`rounded-2xl border p-4 flex-1 flex flex-col justify-center shadow-xs transition-colors ${
                  isDarkMode ? "bg-[#18181b] border-zinc-800" : "bg-white border-zinc-200"
                }`}
              >
                <div className="text-[11px] font-mono text-blue-500 font-bold flex items-center gap-1.5 mb-1.5 uppercase">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Расчетное отправление
                </div>
                <div className="text-3xl font-mono font-black tracking-tight">
                  {departureTimeStr} <span className="text-sm font-semibold text-zinc-500">МСК</span>
                </div>
                <div className="text-[11px] text-zinc-500 font-mono mt-1">
                  Синхронизация АСУ-РДС ±0.1 с
                </div>
              </div>

              {/* Audio Informer Status */}
              <div
                className={`rounded-2xl border p-4 flex-1 flex flex-col justify-center shadow-xs transition-colors ${
                  isDarkMode ? "bg-[#18181b] border-zinc-800" : "bg-white border-zinc-200"
                }`}
              >
                <div className="text-[11px] font-mono font-bold flex items-center gap-1.5 mb-1 text-emerald-600">
                  <Volume2 className="w-4 h-4 text-emerald-500" />
                  Автоинформатор в салоне
                </div>
                <p className={`text-xs italic pl-2.5 border-l-2 border-emerald-500 my-1 ${
                  isDarkMode ? "text-zinc-300" : "text-zinc-700"
                }`}>
                  «Уважаемые пассажиры, технологическая регулировка интервала движения».
                </p>
                <span className="text-[10px] text-emerald-600 font-mono font-semibold">
                  ✓ Оповещение воспроизведено
                </span>
              </div>
            </div>
          </div>

          {/* Clean Visual Situational Track (No dense walls of text!) */}
          <div
            className={`rounded-2xl border p-4 shadow-xs transition-colors ${
              isDarkMode ? "bg-[#18181b] border-zinc-800" : "bg-white border-zinc-200"
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Схема перегона: «Бауманская ➔ Бакунинская»
              </span>
              <span className="text-xs font-mono font-bold text-amber-600">
                Дистанция до лидера: 480 м (увеличивается)
              </span>
            </div>

            {/* Clear Graphical Line Track */}
            <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
              isDarkMode ? "bg-[#121214] border-zinc-800" : "bg-zinc-50 border-zinc-200"
            }`}>
              {/* Leader Bus Pill */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-600 font-mono font-black text-xs flex items-center justify-center">
                  1042
                </div>
                <div>
                  <div className="text-xs font-bold">Лидер #1042</div>
                  <div className="text-[10px] text-zinc-500 font-mono">Впереди • +3.2 мин</div>
                </div>
              </div>

              {/* Gap Track */}
              <div className="flex-1 flex flex-col items-center px-4">
                <div className="text-[10px] font-mono text-zinc-500 font-bold mb-1">
                  Разрыв восстанавливается ➔ Такт 7.5 мин
                </div>
                <div className="w-full flex items-center">
                  <div className="h-0.5 flex-1 bg-amber-500/40" />
                  <ArrowRight className="w-4 h-4 text-amber-500 mx-1 shrink-0" />
                  <div className="h-0.5 flex-1 bg-emerald-500/40" />
                </div>
              </div>

              {/* Current Bus Pill */}
              <div className="flex items-center gap-2 text-right">
                <div>
                  <div className="text-xs font-bold text-emerald-600">Ваш борт #1043</div>
                  <div className="text-[10px] text-zinc-500 font-mono">На стоянке</div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 font-mono font-black text-xs flex items-center justify-center">
                  1043
                </div>
              </div>
            </div>
          </div>

          {/* Large Action Confirm Button */}
          <div className="mt-auto">
            <button
              onClick={handleAck}
              className={`w-full py-3.5 px-6 rounded-xl font-bold flex items-center justify-center gap-2.5 shadow-md transition-all active:scale-[0.99] cursor-pointer ${
                secondsLeft === 0
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                  : isAcked
                  ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                  : "bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-emerald-950/20"
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm sm:text-base font-extrabold uppercase font-mono tracking-wide">
                {isAcked
                  ? `Директива принята (${ackTime || "14:48:10"}) • Стоянка активна`
                  : secondsLeft === 0
                  ? "Время стоянки истекло • Закрыть двери и начать движение"
                  : "Подтвердить прием и выполнение директивы"}
              </span>
            </button>
          </div>
        </section>
      </main>

      {/* 3. BOTTOM TELEMETRY SHELF */}
      <footer className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
        {/* Speedometer */}
        <div
          className={`rounded-xl border p-2.5 flex items-center gap-3 shadow-xs transition-colors ${
            isDarkMode ? "bg-[#18181b] border-zinc-800" : "bg-white border-zinc-200"
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center font-mono ${
            isDarkMode ? "bg-[#222226] text-white" : "bg-zinc-100 text-zinc-900"
          }`}>
            <span className="text-lg font-black leading-none">0</span>
            <span className="text-[8px] text-zinc-500 font-bold">КМ/Ч</span>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-mono uppercase font-bold">Скорость ТС</div>
            <div className="font-mono text-xs font-bold text-amber-600">Ручной тормоз [P]</div>
          </div>
        </div>

        {/* Headway Behind */}
        <div
          className={`rounded-xl border p-2.5 flex flex-col justify-between shadow-xs transition-colors ${
            isDarkMode ? "bg-[#18181b] border-zinc-800" : "bg-white border-zinc-200"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>Сзади #1042</span>
            <span className="text-rose-600 font-bold">СХЛОПЫВАНИЕ</span>
          </div>
          <div className="text-sm font-mono font-bold my-0.5">
            <span className="text-rose-600">1.4 мин</span>
            <span className="text-zinc-400 mx-1">➔</span>
            <span className="text-emerald-600">7.5 мин</span>
          </div>
          <div className="text-[9px] text-zinc-500 font-mono">Выравнивание такта</div>
        </div>

        {/* Headway Ahead */}
        <div
          className={`rounded-xl border p-2.5 flex flex-col justify-between shadow-xs transition-colors ${
            isDarkMode ? "bg-[#18181b] border-zinc-800" : "bg-white border-zinc-200"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>Впереди #1041</span>
            <span className="text-emerald-600 font-bold">НОРМА</span>
          </div>
          <div className="text-sm font-mono font-black text-emerald-600 my-0.5">8.2 мин</div>
          <div className="text-[9px] text-zinc-500 font-mono">Дистанция: 2.8 км</div>
        </div>

        {/* Traction Battery */}
        <div
          className={`rounded-xl border p-2.5 flex flex-col justify-between shadow-xs transition-colors ${
            isDarkMode ? "bg-[#18181b] border-zinc-800" : "bg-white border-zinc-200"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>Тяга (SOC) 650V</span>
            <span className="font-bold text-zinc-700 dark:text-zinc-300">142 км</span>
          </div>
          <div className="flex items-center gap-2 my-0.5">
            <span className="font-mono text-base font-black">84%</span>
            <div className={`flex-1 h-2 rounded-full overflow-hidden p-0.5 border ${
              isDarkMode ? "bg-[#121214] border-zinc-700" : "bg-zinc-100 border-zinc-200"
            }`}>
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: "84%" }} />
            </div>
          </div>
          <div className="text-[9px] text-emerald-600 font-mono">Оптимум (+28°C)</div>
        </div>

        {/* Dispatcher Voice Call */}
        <button className={`col-span-2 sm:col-span-1 rounded-xl p-2.5 flex items-center justify-center gap-2 border transition-all cursor-pointer shadow-xs active:scale-95 ${
          isDarkMode
            ? "bg-[#222226] hover:bg-[#2b2b30] border-zinc-700 text-zinc-200"
            : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800"
        }`}>
          <div className="w-8 h-8 rounded-full bg-red-600/10 border border-red-600/20 flex items-center justify-center shrink-0">
            <PhoneCall className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-left font-mono leading-tight">
            <div className="text-xs font-bold uppercase">Диспетчер</div>
            <div className="text-[10px] text-zinc-500">Сектор «Центр»</div>
          </div>
        </button>
      </footer>
    </div>
  );
};

export default DriverTerminal;
