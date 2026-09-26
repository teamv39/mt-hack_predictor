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
  Compass,
  Smartphone,
} from "lucide-react";

export type SimulationAction = "play" | "pause" | "speed" | "step" | "reset";

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
  onControl?: (action: SimulationAction, value?: number | string) => void | Promise<void>;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onOpenGuide?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  metrics,
  activeTab = "hall",
  setActiveTab,
  isSimPlaying = true,
  simSpeed = 1,
  onControl,
  isDarkMode = false,
  onToggleDarkMode,
  onOpenGuide,
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
      className="h-14 w-full bg-gradient-to-r from-[#D32F2F] via-[#CC1E1E] to-[#B71C1C] border-b border-[#9E1212] px-4 lg:px-5 flex items-center justify-between relative z-30 select-none text-white shadow-lg shadow-red-950/20 shrink-0 font-sans"
      data-purpose="top-navigation-bar"
    >
      {/* 1. BRANDING & NAVIGATION TABS */}
      <div className="flex items-center gap-4">
        {/* Brand Lockup */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center shadow-inner shrink-0">
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
              <span className="text-[13px] font-black tracking-tight uppercase text-white">
                Московский Транспорт
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded font-mono bg-white text-[#D32F2F] shadow-xs">
                ЦОДД
              </span>
            </div>
            <span className="text-[10px] font-medium text-red-100/90 tracking-tight">
              Ситуационный Центр • СППР Headway DSS
            </span>
          </div>
        </div>

        {/* Subtle Divider */}
        <div className="h-6 w-px bg-white/25 hidden md:block" />

        {/* Navigation Tabs Pill */}
        <nav className="flex items-center p-1 rounded-xl bg-black/20 border border-white/20 gap-1 backdrop-blur-xs">
          <button
            onClick={() => setActiveTab && setActiveTab("hall")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "hall" || activeTab === "map"
                ? "bg-white text-[#D32F2F] shadow-sm font-black"
                : "text-red-100 hover:text-white hover:bg-white/10"
            }`}
          >
            <Layers size={13} />
            <span>Карта GIS</span>
          </button>

          <button
            onClick={() => setActiveTab && setActiveTab("marey")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "marey"
                ? "bg-white text-[#D32F2F] shadow-sm font-black"
                : "text-red-100 hover:text-white hover:bg-white/10"
            }`}
          >
            <Activity size={13} />
            <span>График Марея (м3)</span>
          </button>

          <button
            onClick={() => setActiveTab && setActiveTab("terminal")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "terminal"
                ? "bg-white text-[#D32F2F] shadow-sm font-black"
                : "text-red-100 hover:text-white hover:bg-white/10"
            }`}
          >
            <Smartphone size={13} />
            <span>Терминал борта</span>
          </button>
        </nav>
      </div>

      {/* 2. CENTER: DIGITAL CLOCK CAPSULE */}
      <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1 rounded-full border border-white/20 bg-black/25 text-white shadow-inner">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="text-sm font-bold font-mono tracking-wider text-white">
          {timeStr}
        </span>
        <span className="text-[10px] font-bold font-mono text-red-200 uppercase tracking-widest pl-0.5">
          МСК (UTC+3)
        </span>
      </div>

      {/* 3. RIGHT CONTROLS & KPIS */}
      <div className="flex items-center gap-2.5">
        {/* KPI Pills Group */}
        <div className="flex items-center gap-1.5">
          {/* Punctuality Rate */}
          <div className="h-8 px-2.5 rounded-xl border border-emerald-400/40 bg-emerald-950/70 text-emerald-200 flex items-center gap-1.5 shadow-xs">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-black font-mono">{punctuality}</span>
              <span className="text-[10px] font-bold uppercase tracking-tight text-emerald-300/80 hidden xl:inline">
                Такт
              </span>
            </div>
          </div>

          {/* Active Incidents */}
          <div className="h-8 px-2.5 rounded-xl border border-white/20 bg-black/25 text-white flex items-center gap-1.5 shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0 animate-pulse" />
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-black font-mono">{incidentsCount}</span>
              <span className="text-[10px] font-bold uppercase tracking-tight text-red-200 hidden xl:inline">
                Сбоя
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-white/25 hidden sm:block" />

        {/* Simulation Controls Group */}
        <div className="flex items-center p-0.5 rounded-xl border border-white/20 bg-black/20 gap-1">
          <button
            onClick={() => onControl && onControl(isSimPlaying ? "pause" : "play")}
            className={`h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
              isSimPlaying
                ? "bg-white text-[#D32F2F] shadow-xs hover:bg-red-50"
                : "bg-emerald-500 hover:bg-emerald-400 text-white shadow-xs"
            }`}
            title={isSimPlaying ? "Пауза симуляции" : "Запуск симуляции"}
          >
            {isSimPlaying ? <Pause size={12} /> : <Play size={12} />}
            <span className="hidden xl:inline">{isSimPlaying ? "Пауза" : "Пуск"}</span>
          </button>

          <button
            onClick={() =>
              onControl &&
              onControl("speed", simSpeed === 1 ? 5 : simSpeed === 5 ? 10 : 1)
            }
            className="h-7 px-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer hover:bg-white/10 text-white"
            title="Скорость симуляции"
          >
            {simSpeed}x
          </button>

          <button
            onClick={() => onControl && onControl("reset")}
            className="h-7 w-7 rounded-lg flex items-center justify-center transition-all cursor-pointer hover:bg-white/10 text-red-200 hover:text-white"
            title="Сбросить симуляцию"
          >
            <RotateCcw size={12} />
          </button>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-white/25 hidden sm:block" />

        {/* Quick Utility Actions */}
        <div className="flex items-center gap-1.5">
          {/* Jury Guide / Tour button */}
          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="h-8 px-2.5 rounded-xl border border-white/30 bg-white/20 hover:bg-white/30 text-white flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              title="Инструкция для экспертов и жюри (Демо-тур)"
            >
              <Compass size={13} className="text-amber-300" />
              <span className="hidden md:inline font-mono text-[11px]">Гайд жюри</span>
            </button>
          )}

          {/* Dark / Light Toggle */}
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              className="h-8 w-8 rounded-xl flex items-center justify-center border border-white/20 bg-black/20 hover:bg-white/15 text-white transition-all cursor-pointer shadow-xs"
              title={isDarkMode ? "Светлая карта" : "Темная видеостена ЦОДД"}
            >
              {isDarkMode ? <Sun size={14} className="text-amber-300" /> : <Moon size={14} className="text-white" />}
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="h-8 w-8 rounded-xl flex items-center justify-center border border-white/20 bg-black/20 hover:bg-white/15 text-white transition-all cursor-pointer shadow-xs"
            title={isMuted ? "Включить звук" : "Выключить звук"}
          >
            {isMuted ? <VolumeX size={14} className="text-red-300" /> : <Volume2 size={14} />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className="h-8 w-8 rounded-xl flex items-center justify-center border border-white/20 bg-black/20 hover:bg-white/15 text-white transition-all cursor-pointer shadow-xs"
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
