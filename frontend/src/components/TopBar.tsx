import React, { useState, useEffect } from "react";
import {
  Menu,
  CheckCircle,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Maximize2,
} from "lucide-react";

export interface TopBarProps {
  metrics?: {
    vehiclesOnLine?: number;
    punctualityRate?: number;
    activeIncidentsCount?: number;
    preventedIncidentsCount?: number;
    [key: string]: any;
  };
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  isSimPlaying?: boolean;
  simSpeed?: number;
  onControl?: (action: string, value?: any) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  metrics,
  activeTab = "hall",
  setActiveTab,
  isSimPlaying = true,
  simSpeed = 1,
  onControl,
}) => {
  const [timeStr, setTimeStr] = useState<string>("07:13:58");

  // Dynamic ticking clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setTimeStr(`${h}:${m}:${s}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const punctuality = metrics?.punctualityRate != null 
    ? `${metrics.punctualityRate.toFixed(1)}%` 
    : "94.8%";
  const incidentsCount = metrics?.activeIncidentsCount ?? 3;

  return (
    <header className="h-14 w-full bg-white border-b border-slate-200/90 px-4 flex items-center justify-between shadow-2xs relative z-30 select-none">
      {/* 1. БРЕНДИНГ И ЛОГОТИПЫ: Московский Транспорт + ЦОДД */}
      <div className="flex items-center space-x-3.5">
        {/* Квадратная красная кнопка меню */}
        <button
          aria-label="Меню системы"
          className="w-9 h-9 rounded-lg bg-[#DA251D] flex items-center justify-center text-white hover:bg-[#B31B15] transition-colors shadow-2xs focus:outline-none cursor-pointer"
        >
          <Menu className="w-5 h-5 text-white" />
        </button>

        {/* Московский Транспорт */}
        <div className="flex items-center space-x-2">
          <svg className="w-7 h-7 text-[#DA251D] fill-current shrink-0" viewBox="0 0 100 100">
            <circle cx="50" cy="50" fill="none" r="46" stroke="currentColor" strokeWidth="8" />
            <circle cx="50" cy="50" fill="none" r="28" stroke="currentColor" strokeWidth="7" />
            <circle cx="50" cy="50" fill="currentColor" r="12" />
            <path
              d="M50 4 V22 M50 78 V96 M4 50 H22 M78 50 H96"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="8"
            />
          </svg>
          <div className="flex flex-col leading-tight">
            <span className="text-[12px] font-black tracking-tight text-slate-900 uppercase">
              Московский
            </span>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              Транспорт
            </span>
          </div>
        </div>

        {/* Разделитель */}
        <div className="h-6 w-px bg-slate-200 mx-1" />

        {/* ЦОДД Ситуационный Центр */}
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-full border-2 border-[#DA251D] flex items-center justify-center shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#DA251D]" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[12px] font-black tracking-tight text-slate-900 uppercase">
              ЦОДД
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
              Ситуационный Центр
            </span>
          </div>
        </div>
      </div>

      {/* 2. ЦЕНТР: ЭЛЕКТРОННЫЕ ЧАСЫ (МСК) С ЖИВЫМ БИКОНОМ */}
      <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 shadow-2xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-sm font-black font-mono tracking-wider text-slate-800">
          {timeStr}
        </span>
        <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider pl-1">
          МСК (UTC+3)
        </span>
      </div>

      {/* 3. ПРАВЫЙ БЛОК: СТАТУСНЫЕ ПИЛЮЛИ И УПРАВЛЕНИЕ СИМУЛЯЦИЕЙ */}
      <div className="flex items-center space-x-2.5">
        {/* Пунктуальность */}
        <div
          className={`h-8 px-3 rounded-full flex items-center gap-1.5 shadow-2xs border ${
            metrics?.punctualityRate != null && metrics.punctualityRate < 70
              ? "bg-rose-50 border-rose-200 text-rose-700"
              : metrics?.punctualityRate != null && metrics.punctualityRate < 85
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <CheckCircle
            className={`w-4 h-4 shrink-0 ${
              metrics?.punctualityRate != null && metrics.punctualityRate < 70
                ? "text-rose-600"
                : metrics?.punctualityRate != null && metrics.punctualityRate < 85
                ? "text-amber-600"
                : "text-emerald-600"
            }`}
          />
          <span className="text-[11px] font-extrabold uppercase tracking-tight">
            {punctuality} ПУНКТУАЛЬНОСТЬ
          </span>
        </div>

        {/* Инциденты */}
        <div className="h-8 px-3 rounded-full bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-1.5 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="text-[11px] font-extrabold uppercase tracking-tight">
            {incidentsCount} ИНЦИДЕНТА
          </span>
        </div>

        {/* Разделитель */}
        <div className="h-5 w-px bg-slate-200 mx-0.5" />

        {/* Управление симуляцией */}
        <button
          onClick={() => onControl && onControl(isSimPlaying ? "pause" : "play")}
          className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all border shadow-2xs cursor-pointer ${
            isSimPlaying
              ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
              : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500"
          }`}
          title={isSimPlaying ? "Пауза симуляции" : "Запуск симуляции"}
        >
          {isSimPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span className="hidden lg:inline">{isSimPlaying ? "Пауза" : "Пуск"}</span>
        </button>

        {/* Скорость симуляции */}
        <button
          onClick={() => onControl && onControl("speed", simSpeed === 1 ? 5 : simSpeed === 5 ? 10 : 1)}
          className="h-8 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs cursor-pointer"
          title="Скорость симуляции"
        >
          {simSpeed}x
        </button>

        {/* Сброс */}
        <button
          onClick={() => onControl && onControl("reset")}
          className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center border border-slate-200 shadow-2xs cursor-pointer"
          title="Сбросить симуляцию к началу"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};

export default TopBar;
