import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Activity,
  Layers,
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
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  metrics,
  activeTab = "hall",
  setActiveTab,
  isSimPlaying = true,
  simSpeed = 1,
  onControl,
  isDarkMode = true,
  onToggleDarkMode,
}) => {
  const [timeStr, setTimeStr] = useState<string>("07:14:00");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

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

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const punctuality =
    metrics?.punctualityRate != null
      ? `${metrics.punctualityRate.toFixed(1)}%`
      : "94.8%";
  const incidentsCount = metrics?.activeIncidentsCount ?? 3;

  return (
    <header
      className={`h-14 w-full border-b px-5 flex items-center justify-between relative z-30 select-none transition-colors duration-200 shrink-0 ${
        isDarkMode
          ? "bg-[#0E1524] border-slate-800 text-white shadow-lg shadow-black/20"
          : "bg-white border-slate-200 text-slate-900 shadow-xs"
      }`}
    >
      {/* 1. BRANDING & NAVIGATION TABS */}
      <div className="flex items-center gap-4">
        {/* Brand Lockup */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#DA251D] flex items-center justify-center shadow-md shadow-red-900/30 shrink-0">
            <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="none" r="46" stroke="currentColor" strokeWidth="9" />
              <circle cx="50" cy="50" fill="none" r="28" stroke="currentColor" strokeWidth="8" />
              <circle cx="50" cy="50" fill="currentColor" r="12" />
              <path
                d="M50 4 V22 M50 78 V96 M4 50 H22 M78 50 H96"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="9"
              />
            </svg>
          </div>

          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-black tracking-tight uppercase">
                Московский Транспорт
              </span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded font-mono ${
                isDarkMode ? "bg-blue-900/60 text-cyan-300" : "bg-blue-100 text-blue-800"
              }`}>
                ЦОДД
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-400">
              Ситуационный Центр • СППР Headway DSS
            </span>
          </div>
        </div>

        {/* Subtle Divider */}
        <div className={`h-6 w-px ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`} />

        {/* Navigation Tabs Pill */}
        <nav
          className={`flex items-center p-1 rounded-xl border gap-1 ${
            isDarkMode
              ? "bg-[#080D17] border-slate-800/90"
              : "bg-slate-100 border-slate-200"
          }`}
        >
          <button
            onClick={() => setActiveTab && setActiveTab("hall")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "hall" || activeTab === "map"
                ? isDarkMode
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-white text-slate-900 shadow-sm"
                : isDarkMode
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers size={13} />
            <span>Карта GIS</span>
          </button>

          <button
            onClick={() => setActiveTab && setActiveTab("marey")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "marey"
                ? "bg-[#2563eb] text-white shadow-sm"
                : isDarkMode
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Activity size={13} />
            <span>График Марея (м3)</span>
          </button>

          <button
            onClick={() => setActiveTab && setActiveTab("terminal")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "terminal"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : isDarkMode
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>📱 Терминал борта</span>
          </button>
        </nav>
      </div>

      {/* 2. CENTER: DIGITAL CLOCK CAPSULE */}
      <div
        className={`hidden lg:flex items-center gap-2.5 px-4 py-1.5 rounded-full border shadow-sm ${
          isDarkMode
            ? "bg-[#141C2B] border-slate-700/80 text-white"
            : "bg-slate-100 border-slate-200 text-slate-800"
        }`}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <span className="text-sm font-bold font-mono tracking-wider">
          {timeStr}
        </span>
        <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest pl-0.5">
          МСК (UTC+3)
        </span>
      </div>

      {/* 3. RIGHT CONTROLS & KPIS */}
      <div className="flex items-center gap-3">
        {/* KPI Pills Group */}
        <div className="flex items-center gap-2">
          {/* Punctuality Rate */}
          <div
            className={`h-8 px-3 rounded-xl border flex items-center gap-2 shadow-xs ${
              isDarkMode
                ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-300"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-black font-mono">{punctuality}</span>
              <span className="text-[10px] font-bold uppercase tracking-tight text-emerald-400/80 hidden xl:inline">
                Такт
              </span>
            </div>
          </div>

          {/* Active Incidents */}
          <div
            className={`h-8 px-3 rounded-xl border flex items-center gap-2 shadow-xs ${
              isDarkMode
                ? "bg-rose-950/40 border-rose-800/80 text-rose-300"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-pulse" />
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-black font-mono">{incidentsCount}</span>
              <span className="text-[10px] font-bold uppercase tracking-tight text-rose-400/80 hidden xl:inline">
                Сбоя
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className={`h-6 w-px ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`} />

        {/* Simulation Controls Group */}
        <div
          className={`flex items-center p-0.5 rounded-xl border gap-1 ${
            isDarkMode
              ? "bg-[#080D17] border-slate-800"
              : "bg-slate-100 border-slate-200"
          }`}
        >
          <button
            onClick={() => onControl && onControl(isSimPlaying ? "pause" : "play")}
            className={`h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
              isSimPlaying
                ? isDarkMode
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  : "bg-white hover:bg-slate-50 text-slate-800 shadow-xs"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
            }`}
            title={isSimPlaying ? "Пауза симуляции" : "Запуск симуляции"}
          >
            {isSimPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span className="hidden xl:inline">{isSimPlaying ? "Пауза" : "Пуск"}</span>
          </button>

          <button
            onClick={() =>
              onControl &&
              onControl("speed", simSpeed === 1 ? 5 : simSpeed === 5 ? 10 : 1)
            }
            className={`h-7 px-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              isDarkMode
                ? "hover:bg-slate-800 text-slate-300"
                : "hover:bg-white text-slate-700"
            }`}
            title="Скорость симуляции"
          >
            {simSpeed}x
          </button>

          <button
            onClick={() => onControl && onControl("reset")}
            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              isDarkMode
                ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                : "hover:bg-white text-slate-600 hover:text-slate-900"
            }`}
            title="Сбросить симуляцию"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Divider */}
        <div className={`h-6 w-px ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`} />

        {/* Quick Utility Actions */}
        <div className="flex items-center gap-1.5">
          {/* Dark / Light Toggle */}
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              className={`h-8 w-8 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                isDarkMode
                  ? "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-cyan-300"
                  : "bg-white hover:bg-slate-100 border-slate-200 text-amber-600 shadow-xs"
              }`}
              title={isDarkMode ? "Светлая карта" : "Темная видеостена ЦОДД"}
            >
              {isDarkMode ? <Moon size={14} /> : <Sun size={14} />}
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`h-8 w-8 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
              isMuted
                ? isDarkMode
                  ? "bg-rose-950/40 border-rose-800 text-rose-400"
                  : "bg-rose-50 border-rose-200 text-rose-600"
                : isDarkMode
                ? "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-slate-200"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-600 shadow-xs"
            }`}
            title={isMuted ? "Включить звук" : "Выключить звук"}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className={`h-8 w-8 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
              isDarkMode
                ? "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-slate-200"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-600 shadow-xs"
            }`}
            title={isFullscreen ? "Выйти из полного экрана" : "На весь экран"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
