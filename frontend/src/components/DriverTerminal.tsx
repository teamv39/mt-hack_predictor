import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Clock,
  Radio,
  Wifi,
  PhoneCall,
  AlertTriangle,
  Battery,
  ShieldCheck,
  DoorClosed,
  Volume2,
  Sun,
  Moon,
  User,
  Zap,
  Navigation,
} from "lucide-react";

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
  // Allow terminal to respect parent theme or toggle independently in the cab
  const [internalDarkMode, setInternalDarkMode] = useState<boolean>(propDarkMode);
  const [secondsLeft, setSecondsLeft] = useState<number>(138); // 02:18
  const [isAcked, setIsAcked] = useState<boolean>(false);
  const [ackTime, setAckTime] = useState<string>("");
  const [timeStr, setTimeStr] = useState<string>("14:45:12");

  // Keep in sync with parent theme changes
  useEffect(() => {
    setInternalDarkMode(propDarkMode);
  }, [propDarkMode]);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setTimeStr(`${h}:${m}:${s}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Holding Countdown Timer
  useEffect(() => {
    if (!isHoldingActive || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isHoldingActive, secondsLeft]);

  const handleAck = () => {
    setIsAcked(true);
    setAckTime(timeStr);
    if (onAcknowledge) onAcknowledge();
  };

  const min = Math.floor(secondsLeft / 60);
  const sec = secondsLeft % 60;
  const timerDisplay = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

  const isDark = internalDarkMode;

  return (
    <div
      className={`w-full h-full flex flex-col justify-between font-sans select-none overflow-hidden p-3 gap-2.5 transition-colors duration-200 ${
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
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            КОМПЛЕКС АСУ-РДС / NDTP
          </span>
          <span className="text-slate-400">|</span>
          <span className="hidden sm:inline">
            Бортовой терминал «Гранит-Навигатор v4.2» • Исполнительный узел СППР ЦОДД
          </span>
          <span className="sm:hidden">Гранит-Навигатор • СППР</span>
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
            onClick={() => setInternalDarkMode(!internalDarkMode)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
              isDark
                ? "bg-slate-800 hover:bg-slate-700 border-slate-600 text-amber-300"
                : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
            }`}
            title="Переключить день/ночь в кабине"
          >
            {isDark ? <Sun size={12} className="text-amber-400" /> : <Moon size={12} className="text-blue-600" />}
            <span>{isDark ? "День" : "Ночь"}</span>
          </button>
        </div>
      </div>

      {/* 1. TOP HARDWARE STATUS BAR */}
      <header
        className={`border-2 rounded-xl px-4 py-2 flex justify-between items-center shrink-0 shadow-md transition-colors ${
          isDark ? "bg-[#060e20] border-[#2d3449]" : "bg-white border-slate-300"
        }`}
      >
        {/* Brand Anchor & Vehicle Stamp */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#d32f2f] flex items-center justify-center border border-[#ffb3ac] shrink-0 shadow-md">
            <span className="font-mono font-black text-white text-xs">МТ</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span
                className={`font-mono font-black text-sm tracking-wider uppercase ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                GRANIT-NAVIGATOR v4.2 [МАРШРУТ {routeNumber} | БОРТ {vehicleId}]
              </span>
              <span className="bg-[#008058] text-[#d3ffe5] px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                КАМАЗ-6282 ЭЛЕКТРОБУС
              </span>
            </div>
            <span className={`text-[10px] font-mono tracking-tight ${isDark ? "text-[#ab8985]" : "text-slate-500"}`}>
              ЕГПТС МОСГОРТРАНС • ФИЛИАЛ СЕВЕРО-ВОСТОЧНЫЙ • ПАРК 6
            </span>
          </div>
        </div>

        {/* Telemetry Links & Driver ID */}
        <div className="flex items-center gap-2.5 font-mono text-xs">
          {/* Clock */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 border rounded-lg font-bold ${
              isDark
                ? "bg-[#171f33] border-[#2d3449] text-amber-400"
                : "bg-slate-50 border-slate-300 text-amber-600"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>{timeStr} МСК</span>
          </div>

          {/* GLONASS / GPS */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-[11px] font-bold ${
              isDark
                ? "bg-[#171f33] border-[#2d3449] text-emerald-400"
                : "bg-slate-50 border-slate-300 text-emerald-700"
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>ГЛОНАСС: 18 СПУТН.</span>
          </div>

          {/* 4G LTE / NDTP */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-[11px] font-bold ${
              isDark
                ? "bg-[#171f33] border-[#2d3449] text-cyan-400"
                : "bg-slate-50 border-slate-300 text-cyan-700"
            }`}
          >
            <Wifi className="w-3.5 h-3.5 text-cyan-500" />
            <span>NDTP :9201 [12мс]</span>
          </div>

          {/* Driver Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 border rounded-lg text-[11px] ${
              isDark
                ? "bg-[#171f33] border-[#2d3449] text-slate-300"
                : "bg-slate-50 border-slate-300 text-slate-700"
            }`}
          >
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>ТАБ. №08412 • ИВАНОВ А.В.</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN COCKPIT BODY (Split Grid: Left Horizon, Center Directive) */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
        {/* LEFT COLUMN: Route Horizon & Next Stops (4 cols) */}
        <div className="col-span-4 flex flex-col gap-2.5 min-h-0">
          {/* Current Stop Box */}
          <div
            className={`border-2 rounded-xl p-3 shadow-md flex flex-col gap-1 shrink-0 transition-colors ${
              isDark ? "bg-[#171f33] border-[#2d3449]" : "bg-white border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-wider">
                ТЕКУЩИЙ ПУТЕВОЙ ОРИЕНТИР
              </span>
              <span className="px-1.5 py-0.2 bg-[#d32f2f] text-white rounded text-[9px] font-mono font-bold">
                МАРШРУТ {routeNumber}
              </span>
            </div>
            <span className={`text-[11px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              ТЕКУЩАЯ ОСТАНОВКА:
            </span>
            <div
              className={`text-lg font-black font-mono tracking-tight flex items-center gap-2 ${
                isDark ? "text-white" : "text-slate-950"
              }`}
            >
              <span>МЕТРО БАУМАНСКАЯ</span>
            </div>
            <span className={`text-[10px] font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              ➔ Следование в направлении: Серебряный бор — Семёновская
            </span>
          </div>

          {/* Next Stops Progression */}
          <div
            className={`flex-1 border-2 rounded-xl p-3 shadow-md flex flex-col justify-between overflow-hidden transition-colors ${
              isDark ? "bg-[#171f33] border-[#2d3449]" : "bg-white border-slate-300"
            }`}
          >
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              ГОРИЗОНТ МАРШРУТА • ОКНО ВЫРАВНИВАНИЯ
            </span>

            <div className="flex flex-col gap-2 mt-1.5">
              {/* Active Holding Station */}
              <div
                className={`p-2.5 rounded-lg border-2 flex items-center justify-between ${
                  isDark
                    ? "bg-amber-500/10 border-amber-500"
                    : "bg-amber-50 border-amber-500 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#d32f2f] text-white font-bold text-xs flex items-center justify-center">
                    14
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                      МЕТРО «БАУМАНСКАЯ»
                    </span>
                    <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                      РЕГУЛИРОВОЧНАЯ СТОЯНКА {timerDisplay}
                    </span>
                  </div>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              </div>

              {/* Next Station 15 */}
              <div
                className={`p-2 rounded-lg border flex items-center justify-between ${
                  isDark
                    ? "bg-[#0b1326] border-[#2d3449]"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center ${
                      isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    15
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[11px] font-medium ${isDark ? "text-slate-300" : "text-slate-800"}`}>
                      Бакунинская ул., 84
                    </span>
                    <span className={`text-[9px] font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      Расчет: 14:51:00 (+0.0)
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">ТАКТ ОК</span>
              </div>

              {/* Next Station 16 */}
              <div
                className={`p-2 rounded-lg border flex items-center justify-between ${
                  isDark
                    ? "bg-[#0b1326] border-[#2d3449]"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center ${
                      isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-700"
                    }`}
                  >
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
                <span className={`text-[9px] font-mono ${isDark ? "text-slate-400" : "text-slate-400"}`}>---</span>
              </div>
            </div>

            {/* Interlock Safety Strip (NDTP Signals) */}
            <div
              className={`grid grid-cols-2 gap-2 mt-2 pt-2 border-t ${
                isDark ? "border-[#2d3449]" : "border-slate-200"
              }`}
            >
              <div
                className={`p-2 rounded border flex items-center gap-1.5 text-[10px] font-mono font-bold ${
                  isDark
                    ? "bg-[#0b1326] border-emerald-500/40 text-emerald-400"
                    : "bg-emerald-50 border-emerald-300 text-emerald-800"
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>ХОД ЗАБЛОКИРОВАН [P]</span>
              </div>
              <div
                className={`p-2 rounded border flex items-center gap-1.5 text-[10px] font-mono font-bold ${
                  isDark
                    ? "bg-[#0b1326] border-slate-700 text-slate-300"
                    : "bg-slate-50 border-slate-300 text-slate-700"
                }`}
              >
                <DoorClosed className="w-4 h-4 text-slate-500" />
                <span>ДВЕРИ ЗАКРЫТЫ</span>
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
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-500">
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
            <span className="px-3 py-1 bg-red-600 text-white font-mono font-black text-xs rounded-lg animate-pulse shadow-sm">
              ТАКТ НАРУШЕН
            </span>
          </div>

          {/* Central Countdown LED & Target Departure */}
          <div className="grid grid-cols-12 gap-3.5 my-auto py-2">
            {/* Massive LED Countdown Box */}
            <div
              className={`col-span-7 border-2 border-amber-500/80 rounded-2xl p-4 flex flex-col items-center justify-center shadow-inner ${
                isDark ? "bg-[#000000]" : "bg-slate-950 text-white"
              }`}
            >
              <span className="text-xs font-mono font-bold text-amber-400 tracking-widest uppercase mb-1">
                ОСТАЛОСЬ ВРЕМЕНИ СТОЯНКИ
              </span>
              <div className="text-6xl font-mono font-black text-amber-400 tracking-tight leading-none drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]">
                {timerDisplay}
              </div>
              <div className="mt-2.5 flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>РЕЖИМ ВЫРАВНИВАНИЯ ИНТЕРВАЛА М3</span>
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
                  ТОЧНОЕ ВРЕМЯ ОТПРАВЛЕНИЯ:
                </span>
                <span className="text-2xl font-mono font-black text-cyan-300 drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]">
                  14:47:30
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
                  <Volume2 className="w-4 h-4 text-emerald-500" />
                  <span>Салонный автоинформатор</span>
                </div>
                <span className={`text-[10px] mt-0.5 leading-snug ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Воспроизведено: «Технологическая регулировка интервала».
                </span>
              </div>
            </div>
          </div>

          {/* Official Directive Description Box */}
          <div
            className={`p-2.5 border rounded-xl text-xs font-mono leading-relaxed mb-2.5 ${
              isDark
                ? "bg-[#0b1326] border-[#2d3449] text-slate-300"
                : "bg-slate-50 border-slate-300 text-slate-700"
            }`}
          >
            <span className="font-bold text-amber-600 dark:text-amber-400">Директива Службы движения ЦОДД:</span> ликвидация
            пачкования с бортом <strong>№1042</strong>. Выравнивание такта линии м3 до <strong>7.5 мин</strong>.
            Пассажирские табло остановок и салонный автоинформатор уведомлены.
          </div>

          {/* Huge Touch CTA Button */}
          <button
            onClick={handleAck}
            className={`w-full py-4 rounded-xl font-mono font-black text-base uppercase tracking-wider flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg ${
              isAcked
                ? "bg-[#008058] text-[#d3ffe5] border-2 border-[#6ffbbe]"
                : "bg-[#10b981] hover:bg-[#059669] text-white border-2 border-emerald-400 active:scale-98"
            }`}
          >
            <CheckCircle2 className="w-6 h-6" />
            <span>
              {isAcked
                ? `✓ КВИТИРОВАНО В ${ackTime} • КОМАНДА ПРИНЯТА К ИСПОЛНЕНИЮ`
                : "✓ ПОДТВЕРДИТЬ ПРИЕМ И ВЫПОЛНЕНИЕ ДИРЕКТИВЫ"}
            </span>
          </button>
        </div>
      </div>

      {/* 3. BOTTOM TELEMETRY DOCK (NDTP Parameters: Speed, Headway, Battery, Call) */}
      <footer className="grid grid-cols-12 gap-3 h-20 shrink-0 font-mono">
        {/* Speedometer */}
        <div
          className={`col-span-2 border-2 rounded-xl p-2.5 flex flex-col justify-between ${
            isDark ? "bg-[#060e20] border-[#2d3449]" : "bg-white border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase">
            <span>СКОРОСТЬ</span>
            <span className="text-amber-500">[СТОЯНКА]</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>0</span>
            <span className="text-xs text-slate-400">км/ч</span>
          </div>
          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">✓ ручной тормоз [P]</span>
        </div>

        {/* Headway Back (Bunching alert) */}
        <div
          className={`col-span-3 border-2 rounded-xl p-2.5 flex flex-col justify-between ${
            isDark ? "bg-[#060e20] border-[#d32f2f]" : "bg-white border-red-500 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] text-red-600 dark:text-red-400 font-bold uppercase">
            <span>СЗАДИ: БОРТ #1042</span>
            <span className="bg-red-600 text-white px-1 rounded text-[9px]">СХЛОПЫВАНИЕ</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-red-600 dark:text-red-400">1.4 МИН</span>
            <span className="text-slate-400">➔</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">7.5 МИН</span>
          </div>
          <span className="text-[9px] text-slate-500">Дистанция: 480 м (Пачкование)</span>
        </div>

        {/* Headway Front */}
        <div
          className={`col-span-3 border-2 rounded-xl p-2.5 flex flex-col justify-between ${
            isDark ? "bg-[#060e20] border-[#2d3449]" : "bg-white border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase">
            <span>ВПЕРЕДИ: БОРТ #1041</span>
            <span className="text-emerald-600 dark:text-emerald-400">● НОРМА</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">8.2</span>
            <span className="text-xs text-slate-400">МИН</span>
          </div>
          <span className="text-[9px] text-slate-500">Дистанция: 2.8 км (Штатный такт)</span>
        </div>

        {/* Battery SOC */}
        <div
          className={`col-span-2 border-2 rounded-xl p-2.5 flex flex-col justify-between ${
            isDark ? "bg-[#060e20] border-[#2d3449]" : "bg-white border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase">
            <span>ЗАРЯД (SOC)</span>
            <span className="text-emerald-600 dark:text-emerald-400">142 КМ</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>84%</span>
          </div>
          <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
            <div className="bg-emerald-500 h-full w-[84%]" />
          </div>
        </div>

        {/* Dispatcher Quick Touch Action */}
        <div
          className={`col-span-2 border-2 rounded-xl p-2 flex flex-col justify-center items-center text-center cursor-pointer transition-all active:scale-95 shadow-md ${
            isDark
              ? "bg-[#171f33] border-slate-600 hover:border-slate-400"
              : "bg-white border-slate-300 hover:border-slate-400 text-slate-800"
          }`}
        >
          <PhoneCall className="w-5 h-5 text-amber-500 mb-1" />
          <span className={`text-xs font-black uppercase tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
            ДИСПЕТЧЕР
          </span>
          <span className="text-[9px] text-slate-500">СЕКТОР «ЦЕНТР»</span>
        </div>
      </footer>
    </div>
  );
};

export default DriverTerminal;
