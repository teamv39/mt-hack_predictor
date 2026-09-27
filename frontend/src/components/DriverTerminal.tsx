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
    if (!isHoldingActive) return 0;
    return Math.max(0, Math.round((holdingDeadline - nowMs) / 1000));
  }, [isHoldingActive, holdingDeadline, nowMs]);

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

  const FLEET_TERMINALS = [
    {
      route: "м3",
      id: "1043",
      role: "Лидер (Holding)",
      directive: "Регулировочная стоянка (Холдинг)",
      desc: "Остановка «Метро Бауманская» • Устранение пачкования, выравнивание такта до 7.5 мин",
      isHold: true,
    },
    {
      route: "м3",
      id: "1042",
      role: "Ведомый (Нагон)",
      directive: "Следование по расписанию",
      desc: "Лидер №1043 выдерживает такт на м. Бауманская • Вход в график через 1 перегон",
      isHold: false,
    },
    {
      route: "м7",
      id: "2198",
      role: "Задержка (Затор)",
      directive: "Приоритетный коридор АСУДД",
      desc: "Затор на Николоямской ул. • Продление фазы светофора на 18 сек для нагона",
      isHold: false,
    },
    {
      route: "т88",
      id: "0814",
      role: "Риск такта",
      directive: "Динамическая увязка такта",
      desc: "Сжатие интервала • Стабилизация отправления перед м. Лубянка",
      isHold: false,
    },
  ];

  const [currentUnitId, setCurrentUnitId] = useState<string>(vehicleId || "1043");

  useEffect(() => {
    if (vehicleId) {
      setCurrentUnitId(vehicleId);
    }
  }, [vehicleId]);

  const activeUnit = FLEET_TERMINALS.find((u) => u.id === currentUnitId) || FLEET_TERMINALS[0];

  return (
    <div
      className={`w-full h-full flex flex-col font-sans select-none overflow-y-auto p-4 gap-3 transition-colors duration-200 ${
        isDarkMode ? "bg-[#121214] text-zinc-100" : "bg-[#f4f4f5] text-zinc-900"
      }`}
      data-purpose="driver-terminal-root"
    >
      {/* 1. DIRECTIVE HEADER BANNER */}
      <header
        className={`rounded-xl p-3.5 border transition-colors flex flex-wrap items-center justify-between gap-3 ${
          isDarkMode
            ? "bg-[#18181b] border-white/10"
            : "bg-white border-zinc-200 shadow-2xs"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
              isDarkMode
                ? "bg-[#222226] border-white/10 text-amber-400"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold tracking-tight">
                {activeUnit.directive}
              </h1>
              {/* Unit Selector */}
              <select
                id="driver-terminal-unit-select"
                name="terminal-unit"
                value={currentUnitId}
                onChange={(e) => setCurrentUnitId(e.target.value)}
                className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border cursor-pointer outline-none ${
                  isDarkMode
                    ? "bg-[#222226] text-zinc-200 border-white/10 hover:border-white/20"
                    : "bg-zinc-100 text-zinc-800 border-zinc-200 hover:border-zinc-300"
                }`}
                title="Переключить борт для мониторинга кабины"
              >
                {FLEET_TERMINALS.map((u) => (
                  <option key={u.id} value={u.id} className={isDarkMode ? "bg-[#18181b]" : "bg-white"}>
                    {u.route} • БОРТ {u.id} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <p className={`text-xs mt-0.5 ${isDarkMode ? "text-zinc-400" : "text-zinc-600"}`}>
              {activeUnit.desc}
            </p>
          </div>
        </div>

        {/* System Status and Demo Reset Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDemo}
            className={`h-8 px-2.5 rounded-lg border text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              isDarkMode
                ? "bg-[#222226] hover:bg-white/10 border-white/10 text-zinc-300"
                : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700"
            }`}
            title="Перезапустить таймер для демонстрации"
          >
            <RotateCcw size={13} />
            <span>150 с</span>
          </button>

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
      </header>

      {/* 2. DUAL COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        {/* Left Column: Timetable & Station Schedule (4 cols) */}
        <section
          className={`lg:col-span-4 rounded-xl border p-3.5 flex flex-col justify-between transition-colors ${
            isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200 shadow-2xs"
          }`}
        >
          <div>
            <div className={`flex items-center justify-between pb-2.5 border-b ${
              isDarkMode ? "border-white/10" : "border-zinc-100"
            }`}>
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Маршрут {routeNumber}
              </span>
              <span className="text-[11px] font-mono text-zinc-400">Такт: 7.5 мин</span>
            </div>

            {/* Station Timeline */}
            <div className="mt-3 flex flex-col gap-2">
              {/* Passed Stop 13 */}
              <div className={`flex items-center justify-between p-2 rounded-lg border ${
                isDarkMode ? "bg-[#222226] border-white/5 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-500"
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center ${
                    isDarkMode ? "bg-zinc-800 text-zinc-300" : "bg-zinc-200 text-zinc-700"
                  }`}>
                    13
                  </span>
                  <div>
                    <div className="text-xs line-through">ул. Покровка</div>
                    <div className="text-[9px] font-mono opacity-80">Пройдена в 14:41</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Пройдено</span>
              </div>

              {/* Active Dwell Stop 14 */}
              <div className={`flex items-center justify-between p-2.5 rounded-lg border-2 ${
                isDarkMode
                  ? "bg-amber-950/20 border-amber-500/60 text-white"
                  : "bg-amber-50/60 border-amber-400 text-zinc-900"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                    14
                  </span>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>м. Бауманская</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500 text-white font-bold">ТЕКУЩАЯ</span>
                    </div>
                    <div className={`text-[10px] font-mono font-semibold ${
                      isDarkMode ? "text-amber-400" : "text-amber-600"
                    }`}>
                      Стоянка: {timerDisplay}
                    </div>
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              </div>

              {/* Next Stop 15 */}
              <div className={`flex items-center justify-between p-2 rounded-lg border ${
                isDarkMode ? "bg-[#222226] border-white/5 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-700"
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center ${
                    isDarkMode ? "bg-zinc-800 text-zinc-300" : "bg-zinc-200 text-zinc-700"
                  }`}>
                    15
                  </span>
                  <div>
                    <div className="text-xs font-medium">Бакунинская ул., 84</div>
                    <div className="text-[9px] font-mono text-zinc-400">Расчетное: 14:51:00</div>
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-bold ${
                  isDarkMode ? "text-emerald-400" : "text-emerald-600"
                }`}>
                  Δ 7.5 мин
                </span>
              </div>

              {/* Next Stop 16 */}
              <div className={`flex items-center justify-between p-2 rounded-lg border ${
                isDarkMode ? "bg-[#222226] border-white/5 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-700"
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center ${
                    isDarkMode ? "bg-zinc-800 text-zinc-300" : "bg-zinc-200 text-zinc-700"
                  }`}>
                    16
                  </span>
                  <div>
                    <div className="text-xs font-medium">м. Электрозаводская</div>
                    <div className="text-[9px] font-mono text-zinc-400">Расчетное: 14:54:30</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">Δ 7.8 мин</span>
              </div>
            </div>
          </div>

          {/* Cabin Telemetry Sensor Capsules */}
          <div className={`mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs ${
            isDarkMode ? "border-white/10" : "border-zinc-100"
          }`}>
            <div className={`p-2 rounded-lg border ${
              isDarkMode ? "bg-[#222226] border-white/5" : "bg-zinc-50 border-zinc-200"
            }`}>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
                <Users size={12} className="opacity-70" />
                <span>Салон АСМПП</span>
              </div>
              <div className="font-mono text-xs font-bold mt-1">
                48 <span className="text-[10px] text-zinc-400 font-normal">/ 85 пасс.</span>
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">56% (свободно)</div>
            </div>

            <div className={`p-2 rounded-lg border ${
              isDarkMode ? "bg-[#222226] border-white/5" : "bg-zinc-50 border-zinc-200"
            }`}>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
                <Shield size={12} className="opacity-70" />
                <span>Двери ТС</span>
              </div>
              <div className="font-mono text-xs font-bold text-amber-400 mt-1">
                {secondsLeft > 0 ? "ПОСАДКА РАЗРЕШЕНА" : "ДВЕРИ ЗАКРЫТЫ"}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                Стояночный [P] активен
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Holding Timer & Action Stage (8 cols) */}
        <section className="lg:col-span-8 flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Big Countdown Timer Card (7 cols) */}
            <div
              className={`md:col-span-7 rounded-xl border p-4 flex flex-col justify-between transition-colors ${
                isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  ВРЕМЯ СТОЯНКИ
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                  isDarkMode ? "bg-[#222226] text-zinc-300 border-white/5" : "bg-zinc-100 text-zinc-600 border-zinc-200"
                }`}>
                  Норма: 150 с
                </span>
              </div>

              {/* High-Legibility Tabular Countdown */}
              <div className="py-3 text-center">
                <div className="text-6xl font-mono font-bold tracking-tight text-amber-500 tabular-nums leading-none">
                  {secondsLeft > 0 ? timerDisplay : "00:00"}
                </div>
                <p className={`text-xs font-mono uppercase tracking-wider font-bold mt-2 ${
                  secondsLeft > 0 ? "text-amber-400" : "text-emerald-400"
                }`}>
                  {secondsLeft > 0 ? "Идёт технологическая выдержка такта" : "Стоянка завершена • Начать движение"}
                </p>
              </div>

              {/* Progress Track */}
              <div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1">
                  <span>Выдержка интервала</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden ${
                  isDarkMode ? "bg-zinc-800" : "bg-zinc-200"
                }`}>
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Departure Info & Saloon Announcer (5 cols) */}
            <div className="md:col-span-5 flex flex-col gap-3">
              {/* Target Departure Time */}
              <div
                className={`rounded-xl border p-3.5 flex flex-col justify-between transition-colors ${
                  isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200 shadow-2xs"
                }`}
              >
                <div className={`flex items-center justify-between text-xs ${
                  isDarkMode ? "text-zinc-400" : "text-zinc-500"
                }`}>
                  <span className={`flex items-center gap-1.5 font-bold uppercase tracking-wider ${
                    isDarkMode ? "text-zinc-200" : "text-zinc-700"
                  }`}>
                    <Clock size={13} />
                    Расчетное отправление
                  </span>
                </div>
                <div className="my-2 flex items-baseline gap-2">
                  <span className={`text-3xl font-mono font-bold ${
                    isDarkMode ? "text-white" : "text-zinc-900"
                  }`}>
                    {departureTimeStr}
                  </span>
                  <span className={`text-xs font-mono font-semibold ${
                    isDarkMode ? "text-zinc-400" : "text-zinc-500"
                  }`}>МСК</span>
                </div>
                <div className={`text-[10px] font-mono ${
                  isDarkMode ? "text-zinc-400" : "text-zinc-500"
                }`}>
                  Синхронизация АСУ-РДС ±0.1 с
                </div>
              </div>

              {/* Saloon Audio Informant */}
              <div
                className={`rounded-xl border p-3 flex flex-col justify-between transition-colors ${
                  isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200 shadow-2xs"
                }`}
              >
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${
                  isDarkMode ? "text-zinc-200" : "text-zinc-800"
                }`}>
                  <Volume2 size={13} />
                  <span>Автоинформатор в салоне</span>
                </div>
                <div className={`text-[11px] italic mt-1.5 border-l-2 border-zinc-500 pl-2 leading-relaxed ${
                  isDarkMode ? "text-zinc-300" : "text-zinc-700"
                }`}>
                  «Уважаемые пассажиры, технологическая регулировка интервала движения».
                </div>
                <div className={`text-[10px] font-semibold mt-1 flex items-center gap-1 ${
                  isDarkMode ? "text-emerald-400" : "text-emerald-600"
                }`}>
                  <Check size={11} />
                  <span>Оповещение воспроизведено</span>
                </div>
              </div>
            </div>
          </div>

          {/* Inter-vehicle Headway Graphic */}
          <div
            className={`rounded-xl border p-3.5 flex flex-col gap-2 transition-colors ${
              isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono">
              <span className={`font-bold flex items-center gap-1.5 ${isDarkMode ? "text-zinc-300" : "text-zinc-800"}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Схема перегона: «Бауманская → Бакунинская»
              </span>
              <span className={`font-semibold text-[11px] ${
                isDarkMode ? "text-amber-400" : "text-amber-600"
              }`}>
                Дистанция: 480 м (увеличивается)
              </span>
            </div>

            {/* Gap track */}
            <div className={`p-3 rounded-lg border flex items-center justify-between gap-3 text-xs font-mono ${
              isDarkMode ? "bg-[#141416] border-white/5" : "bg-zinc-50 border-zinc-200"
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-[10px] ${
                  isDarkMode ? "bg-zinc-700" : "bg-zinc-600"
                }`}>
                  1042
                </span>
                <div>
                  <div className={`font-bold text-xs ${isDarkMode ? "text-zinc-200" : "text-zinc-800"}`}>Ведомый #1042</div>
                  <div className={`text-[10px] ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>Сзади • сокращает разрыв</div>
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center px-4">
                <span className={`text-[10px] font-semibold mb-1 ${
                  isDarkMode ? "text-emerald-400" : "text-emerald-600"
                }`}>
                  Разрыв восстанавливается → Такт 7.5 мин
                </span>
                <div className={`w-full h-1.5 rounded-full relative flex items-center ${
                  isDarkMode ? "bg-zinc-700" : "bg-zinc-300"
                }`}>
                  <div className="h-full bg-emerald-500 rounded-full w-2/3" />
                  <ArrowRight size={12} className="absolute right-0 text-emerald-500" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div>
                  <div className={`font-bold text-xs text-right ${
                    isDarkMode ? "text-emerald-400" : "text-emerald-600"
                  }`}>Ваш борт #1043 (Лидер)</div>
                  <div className={`text-[10px] text-right ${
                    isDarkMode ? "text-zinc-400" : "text-zinc-500"
                  }`}>На стоянке • выдержка такта</div>
                </div>
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">
                  1043
                </span>
              </div>
            </div>
          </div>

          {/* Master Confirmation Button */}
          <button
            onClick={handleAck}
            disabled={isAcked}
            className={`w-full py-3 px-4 rounded-xl text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer ${
              isAcked
                ? "bg-zinc-700 text-zinc-300 cursor-default"
                : "bg-emerald-600 hover:bg-emerald-500 active:scale-98 shadow-emerald-900/20"
            }`}
          >
            {isAcked ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <span>Директива подтверждена водительским терминалом ({ackTime})</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Подтвердить прием и выполнение директивы</span>
              </>
            )}
          </button>
        </section>
      </div>

      {/* 3. BOTTOM TELEMETRY STRIP */}
      <footer className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className={`p-2.5 rounded-lg border flex items-center gap-2.5 ${
          isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200"
        }`}>
          <div className={`w-8 h-8 rounded-md flex flex-col items-center justify-center font-mono font-bold text-xs ${
            isDarkMode ? "bg-zinc-800 text-zinc-200" : "bg-zinc-200 text-zinc-700"
          }`}>
            <span>0</span>
            <span className="text-[8px] opacity-75 font-normal">км/ч</span>
          </div>
          <div>
            <div className="text-[10px] text-zinc-400">Скорость ТС</div>
            <div className="font-bold text-amber-500 font-mono">Ручной тормоз [P]</div>
          </div>
        </div>

        <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
          isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200"
        }`}>
          <div>
            <div className="text-[10px] text-zinc-400">Сзади #1042</div>
            <div className="font-bold font-mono text-rose-500">
              1.4 мин → <span className="text-emerald-500">7.5 мин</span>
            </div>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            СХЛОПЫВАНИЕ
          </span>
        </div>

        <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
          isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200"
        }`}>
          <div>
            <div className="text-[10px] text-zinc-400">Впереди #1041</div>
            <div className="font-bold font-mono text-emerald-500">8.2 мин</div>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            НОРМА
          </span>
        </div>

        <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
          isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200"
        }`}>
          <div>
            <div className="text-[10px] text-zinc-400">Тяга (SOC) 650V</div>
            <div className={`font-bold font-mono ${isDarkMode ? "text-zinc-100" : "text-zinc-900"}`}>
              84% • 142 км
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-zinc-400">Диспетчер</div>
            <div className={`font-semibold text-[11px] ${isDarkMode ? "text-zinc-300" : "text-zinc-700"}`}>
              Сектор «Центр»
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DriverTerminal;
