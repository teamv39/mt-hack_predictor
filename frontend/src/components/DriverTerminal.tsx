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
  ChevronRight,
  Maximize2,
  Volume2,
  Sun,
  User,
} from "lucide-react";

interface DriverTerminalProps {
  vehicleId?: string;
  routeNumber?: string;
  isHoldingActive?: boolean;
  onAcknowledge?: () => void;
}

export const DriverTerminal: React.FC<DriverTerminalProps> = ({
  vehicleId = "1043",
  routeNumber = "м3",
  isHoldingActive = true,
  onAcknowledge,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(138); // 02:18
  const [isAcked, setIsAcked] = useState<boolean>(false);
  const [ackTime, setAckTime] = useState<string>("");
  const [timeStr, setTimeStr] = useState<string>("14:45:12");

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

  return (
    <div className="w-full h-full flex flex-col justify-between bg-[#0b1326] text-[#dae2fd] font-sans select-none overflow-hidden p-3 gap-3">
      {/* 1. TOP HARDWARE STATUS BAR */}
      <header className="bg-[#060e20] border-2 border-[#2d3449] rounded-xl px-4 py-2 flex justify-between items-center shrink-0 shadow-lg">
        {/* Brand Anchor & Vehicle Stamp */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#d32f2f] flex items-center justify-center border border-[#ffb3ac] shrink-0 shadow-md">
            <span className="font-mono font-black text-white text-xs">МТ</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm tracking-wider text-white uppercase">
                GRANIT-NAVIGATOR v4.2 [ROUTE {routeNumber} | BOARD {vehicleId}]
              </span>
              <span className="bg-[#008058] text-[#d3ffe5] px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                КАМАЗ-6282 ЭЛЕКТРОБУС
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#ab8985] tracking-tight">
              ЕГПТС МОСГОРТРАНС • ФИЛИАЛ СЕВЕРО-ВОСТОЧНЫЙ • ПАРК 6
            </span>
          </div>
        </div>

        {/* Telemetry Links & Driver ID */}
        <div className="flex items-center gap-3 font-mono text-xs">
          {/* Clock */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#171f33] border border-[#2d3449] rounded-lg text-amber-400 font-bold">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{timeStr} МСК</span>
          </div>

          {/* GLONASS / GPS */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#171f33] border border-[#2d3449] rounded-lg text-emerald-400 text-[11px] font-bold">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>ГЛОНАСС: 18 СПУТН.</span>
          </div>

          {/* 4G LTE */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#171f33] border border-[#2d3449] rounded-lg text-cyan-400 text-[11px] font-bold">
            <Wifi className="w-3.5 h-3.5" />
            <span>АСУ-РДС 99% [12мс]</span>
          </div>

          {/* Driver Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#171f33] border border-[#2d3449] rounded-lg text-slate-300 text-[11px]">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>ТАБ. №08412 • ИВАНОВ А.В.</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN COCKPIT BODY (Split Grid: Left Horizon, Center Directive) */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
        {/* LEFT COLUMN: Route Horizon & Next Stops (4 cols) */}
        <div className="col-span-4 flex flex-col gap-3 min-h-0">
          {/* Current Stop Box */}
          <div className="bg-[#171f33] border-2 border-[#2d3449] rounded-xl p-3 shadow-md flex flex-col gap-1 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                ТЕКУЩИЙ ПУТЕВОЙ ОРИЕНТИР
              </span>
              <span className="px-1.5 py-0.2 bg-[#d32f2f] text-white rounded text-[9px] font-mono font-bold">
                МАРШРУТ {routeNumber}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">ТЕКУЩАЯ ОСТАНОВКА:</span>
            <div className="text-lg font-black text-white font-mono tracking-tight flex items-center gap-2">
              <span>МЕТРО БАУМАНСКАЯ</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              ➔ Следование в направлении: Стадион Лужники
            </span>
          </div>

          {/* Next Stops Progression */}
          <div className="flex-1 bg-[#171f33] border-2 border-[#2d3449] rounded-xl p-3 shadow-md flex flex-col justify-between overflow-hidden">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              ГОРИЗОНТ МАРШРУТА • ОКНО ВЫРАВНИВАНИЯ
            </span>

            <div className="flex flex-col gap-2 mt-2">
              {/* Active Holding Station */}
              <div className="p-2.5 rounded-lg bg-amber-500/10 border-2 border-amber-500 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#d32f2f] text-white font-bold text-xs flex items-center justify-center">
                    14
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">МЕТРО «БАУМАНСКАЯ»</span>
                    <span className="text-[10px] font-mono text-amber-400 font-bold">
                      РЕГУЛИРОВОЧНАЯ СТОЯНКА {timerDisplay}
                    </span>
                  </div>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              </div>

              {/* Next Station 15 */}
              <div className="p-2 rounded-lg bg-[#0b1326] border border-[#2d3449] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 font-bold text-[10px] flex items-center justify-center">
                    15
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-300">Елоховская площадь</span>
                    <span className="text-[9px] font-mono text-slate-500">Расчет: 14:51:00 (+0.0)</span>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-emerald-400 font-bold">ТАКТ ОК</span>
              </div>

              {/* Next Station 16 */}
              <div className="p-2 rounded-lg bg-[#0b1326] border border-[#2d3449] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 font-bold text-[10px] flex items-center justify-center">
                    16
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-300">Пл. Разгуляй</span>
                    <span className="text-[9px] font-mono text-slate-500">Расчет: 14:54:30</span>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-slate-400">---</span>
              </div>
            </div>

            {/* Interlock Safety Strip */}
            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#2d3449]">
              <div className="p-2 rounded bg-[#0b1326] border border-emerald-500/40 flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>ХОД ЗАБЛОКИРОВАН [P]</span>
              </div>
              <div className="p-2 rounded bg-[#0b1326] border border-slate-700 flex items-center gap-1.5 text-[10px] font-mono text-slate-300 font-bold">
                <DoorClosed className="w-4 h-4 text-slate-400" />
                <span>ДВЕРИ ЗАКРЫТЫ</span>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER/RIGHT COLUMN: Directive Callout & Big Action Box (8 cols) */}
        <div className="col-span-8 flex flex-col justify-between bg-[#171f33] border-2 border-amber-500 rounded-xl p-5 shadow-2xl relative overflow-hidden">
          {/* Top Header of Directive */}
          <div className="flex items-start justify-between border-b-2 border-[#2d3449] pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-6 h-6 text-amber-400 animate-bounce" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white font-mono tracking-tight uppercase">
                  ВНИМАНИЕ: РЕГУЛИРОВОЧНАЯ СТОЯНКА (HOLDING)
                </h2>
                <span className="text-[10px] font-mono text-amber-400/90 font-bold">
                  ИДЕНТИФИКАТОР ДИРЕКТИВЫ: ЦОДД-АРД-2026-03-9941 • ПРИОРИТЕТ 1 (ОПЕРАТИВНЫЙ)
                </span>
              </div>
            </div>
            <span className="px-3 py-1 bg-red-950 border border-red-500 text-red-400 font-mono font-black text-xs rounded-lg animate-pulse">
              ТАКТ НАРУШЕН
            </span>
          </div>

          {/* Central Countdown LED & Target Departure */}
          <div className="grid grid-cols-12 gap-4 my-auto py-2">
            {/* Massive LED Countdown Box */}
            <div className="col-span-7 bg-[#000000] border-2 border-amber-500/80 rounded-2xl p-5 flex flex-col items-center justify-center shadow-inner">
              <span className="text-xs font-mono font-bold text-amber-400/90 tracking-widest uppercase mb-1">
                ОСТАЛОСЬ ВРЕМЕНИ СТОЯНКИ
              </span>
              <div className="text-7xl font-mono font-black text-amber-400 tracking-tight leading-none drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]">
                {timerDisplay}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>РЕЖИМ ВЫРАВНИВАНИЯ ИНТЕРВАЛА М3</span>
              </div>
            </div>

            {/* Target Departure & Passenger Info Box */}
            <div className="col-span-5 flex flex-col justify-between gap-3">
              <div className="bg-[#000000] border-2 border-cyan-500/80 rounded-xl p-3.5 flex flex-col justify-center">
                <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  ТОЧНОЕ ВРЕМЯ ОТПРАВЛЕНИЯ:
                </span>
                <span className="text-3xl font-mono font-black text-cyan-300 drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]">
                  14:47:30
                </span>
                <span className="text-[9px] font-mono text-slate-400 mt-1">
                  Синхронизировано по серверу АСУ-РДС с точностью 0.1 сек
                </span>
              </div>

              <div className="bg-[#060e20] border border-[#2d3449] rounded-xl p-3 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>Салонный автоинформатор</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 leading-snug">
                  Воспроизведено сообщение: «Технологическая регулировка интервала».
                </span>
              </div>
            </div>
          </div>

          {/* Official Directive Description Box */}
          <div className="p-3 bg-[#0b1326] border border-[#2d3449] rounded-xl text-xs font-mono text-slate-300 leading-relaxed mb-3">
            <span className="font-bold text-amber-400">Директива Службы движения ЦОДД:</span> ликвидация
            пачкования с бортом <strong>№1042</strong>. Выравнивание такта линии м3 до <strong>7.5 мин</strong>.
            Пассажирские табло остановок и салонный автоинформатор уведомлены.
          </div>

          {/* Huge Touch CTA Button */}
          <button
            onClick={handleAck}
            className={`w-full py-5 rounded-2xl font-mono font-black text-lg uppercase tracking-wider flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xl ${
              isAcked
                ? "bg-[#008058] text-[#d3ffe5] border-2 border-[#6ffbbe]"
                : "bg-[#10b981] hover:bg-[#059669] text-white border-2 border-emerald-400 active:scale-98"
            }`}
          >
            <CheckCircle2 className="w-7 h-7" />
            <span>
              {isAcked
                ? `✓ КВИТИРОВАНО В ${ackTime} • КОМАНДА ПРИНЯТА К ИСПОЛНЕНИЮ`
                : "✓ ПОДТВЕРДИТЬ ПРИЕМ И ВЫПОЛНЕНИЕ"}
            </span>
          </button>
        </div>
      </div>

      {/* 3. BOTTOM TELEMETRY DOCK (Speed, Headway Front, Headway Back, Battery, Dispatcher Call) */}
      <footer className="grid grid-cols-12 gap-3 h-20 shrink-0 font-mono">
        {/* Speedometer */}
        <div className="col-span-2 bg-[#060e20] border-2 border-[#2d3449] rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
            <span>СКОРОСТЬ</span>
            <span className="text-amber-400">[СТОЯНКА]</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white">0</span>
            <span className="text-xs text-slate-400">км/ч</span>
          </div>
          <span className="text-[9px] text-emerald-400">✓ стояночный тормоз вкл</span>
        </div>

        {/* Headway Back (Bunching alert) */}
        <div className="col-span-3 bg-[#060e20] border-2 border-[#d32f2f] rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-red-400 font-bold uppercase">
            <span>СЗАДИ: БОРТ #1042</span>
            <span className="bg-red-950 px-1 rounded text-red-400">СХЛОПЫВАНИЕ</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-red-400">1.4 МИН</span>
            <span className="text-slate-400">➔</span>
            <span className="text-xl font-black text-emerald-400">7.5 МИН</span>
          </div>
          <span className="text-[9px] text-slate-400">Дистанция: 480 м (Пачкование)</span>
        </div>

        {/* Headway Front */}
        <div className="col-span-3 bg-[#060e20] border-2 border-[#2d3449] rounded-xl p-2.5 flex flex-col justify-between">
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

        {/* Battery SOC */}
        <div className="col-span-2 bg-[#060e20] border-2 border-[#2d3449] rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
            <span>ЗАРЯД (SOC)</span>
            <span className="text-emerald-400">142 КМ</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">84%</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-400 h-full w-[84%]" />
          </div>
        </div>

        {/* Dispatcher Quick Touch Action */}
        <div className="col-span-2 bg-[#171f33] border-2 border-slate-600 hover:border-slate-400 rounded-xl p-2 flex flex-col justify-center items-center text-center cursor-pointer transition-all active:scale-95 shadow-md">
          <PhoneCall className="w-5 h-5 text-amber-400 mb-1" />
          <span className="text-xs font-black text-white uppercase tracking-tight">ДИСПЕТЧЕР</span>
          <span className="text-[9px] text-slate-400">СЕКТОР «ЦЕНТР»</span>
        </div>
      </footer>
    </div>
  );
};

export default DriverTerminal;
