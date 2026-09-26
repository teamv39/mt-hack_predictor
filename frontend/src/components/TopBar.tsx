import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
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
  Layers,
  Activity,
  Radio,
  Compass,
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
  const [timeStr, setTimeStr] = useState<string>("14:00:00");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

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
      className={`h-14 w-full px-4 lg:px-5 flex items-center justify-between relative z-30 select-none border-b transition-colors duration-200 shrink-0 font-sans ${
        isDarkMode
          ? "bg-[#141416]/95 border-white/10 text-zinc-100 shadow-md shadow-black/40"
          : "bg-white/95 border-zinc-200/90 text-zinc-800 shadow-xs"
      }`}
      data-purpose="top-navigation-bar"
    >
      {/* 1. BRAND LOCKUP & VIEW SELECTOR */}
      <div className="flex items-center gap-4 lg:gap-6">
        <div className="flex items-center gap-2.5">
          {/* Moscow Transport Ring Emblem */}
          <div className="w-8 h-8 rounded-lg bg-[#D32F2F] flex items-center justify-center text-white shadow-xs shrink-0">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="none" r="44" stroke="currentColor" strokeWidth="10" />
              <circle cx="50" cy="50" fill="none" r="28" stroke="currentColor" strokeWidth="8" />
              <circle cx="50" cy="50" fill="currentColor" r="12" />
              <path
                d="M50 6 V22 M50 78 V94 M6 50 H22 M78 50 H94"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="10"
              />
            </svg>
          </div>

          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span className={`text-[12px] font-bold tracking-tight uppercase ${isDarkMode ? "text-white" : "text-zinc-900"}`}>
                Московский Транспорт
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                isDarkMode ? "bg-white/10 text-zinc-300" : "bg-zinc-100 text-zinc-700"
              }`}>
                ЦОДД
              </span>
            </div>
            <span className={`text-[10px] font-medium tracking-tight ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>
              Ситуационный Центр • СППР Headway DSS
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className={`h-5 w-px hidden md:block ${isDarkMode ? "bg-white/10" : "bg-zinc-200"}`} />

        {/* Segmented View Controls */}
        <nav
          className={`flex items-center p-0.5 rounded-lg border gap-0.5 ${
            isDarkMode
              ? "bg-[#222226] border-white/10"
              : "bg-zinc-100 border-zinc-200"
          }`}
        >
          <button
            onClick={() => setActiveTab && setActiveTab("hall")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "hall" || activeTab === "map"
                ? isDarkMode
                  ? "bg-zinc-700 text-white shadow-xs"
                  : "bg-white text-zinc-900 shadow-xs"
                : isDarkMode
                ? "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-white/60"
            }`}
          >
            <Layers size={13} className="opacity-80" />
            <span>Карта GIS</span>
          </button>

          <button
            onClick={() => setActiveTab && setActiveTab("marey")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "marey"
                ? isDarkMode
                  ? "bg-zinc-700 text-white shadow-xs"
                  : "bg-white text-zinc-900 shadow-xs"
                : isDarkMode
                ? "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-white/60"
            }`}
          >
            <Activity size={13} className="opacity-80" />
            <span>График Марея (м3)</span>
          </button>

          <button
            onClick={() => setActiveTab && setActiveTab("terminal")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "terminal"
                ? isDarkMode
                  ? "bg-zinc-700 text-white shadow-xs"
                  : "bg-white text-zinc-900 shadow-xs"
                : isDarkMode
                ? "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-white/60"
            }`}
          >
            <Radio size={13} className="opacity-80" />
            <span>Терминал борта</span>
          </button>
        </nav>
      </div>

      {/* 2. CENTER TELEMETRY & LIVE CLOCK */}
      <div className="hidden lg:flex items-center gap-2.5">
        {/* Realtime Clock */}
        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono font-medium ${
            isDarkMode
              ? "bg-[#222226] border-white/10 text-zinc-200"
              : "bg-zinc-100 border-zinc-200 text-zinc-700"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="tracking-wider font-semibold">{timeStr}</span>
          <span className={`text-[10px] ${isDarkMode ? "text-zinc-500" : "text-zinc-400"}`}>МСК</span>
        </div>

        {/* Punctuality Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
            isDarkMode
              ? "bg-[#222226] border-white/10 text-zinc-200"
              : "bg-zinc-100 border-zinc-200 text-zinc-700"
          }`}
          title="Соблюдение расписания на маршрутах"
        >
          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
          <span className="font-mono font-bold">{punctuality}</span>
          <span className="text-[11px] opacity-70">график</span>
        </div>

        {/* Risk Alerts Counter */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
            isDarkMode
              ? "bg-[#222226] border-white/10 text-zinc-200"
              : "bg-zinc-100 border-zinc-200 text-zinc-700"
          }`}
          title="Активные риски интервалов"
        >
          <AlertTriangle size={13} className="text-amber-500 shrink-0" />
          <span className="font-mono font-bold">{incidentsCount}</span>
          <span className="text-[11px] opacity-70">риска</span>
        </div>
      </div>

      {/* 3. SIMULATION CONTROLS & UTILITY TOOLBAR */}
      <div className="flex items-center gap-2">
        {/* Play/Pause & Sim speed controls */}
        <div
          className={`flex items-center p-0.5 rounded-lg border gap-0.5 ${
            isDarkMode
              ? "bg-[#222226] border-white/10"
              : "bg-zinc-100 border-zinc-200"
          }`}
        >
          <button
            onClick={() => onControl && onControl(isSimPlaying ? "pause" : "play")}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isDarkMode
                ? "hover:bg-white/10 text-zinc-300 hover:text-white"
                : "hover:bg-white text-zinc-700 hover:text-zinc-900"
            }`}
            title={isSimPlaying ? "Приостановить симуляцию" : "Запустить симуляцию"}
          >
            {isSimPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>

          <button
            onClick={() => onControl && onControl("speed", simSpeed === 1 ? 2 : simSpeed === 2 ? 5 : 1)}
            className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-colors cursor-pointer ${
              isDarkMode
                ? "hover:bg-white/10 text-zinc-300 hover:text-white"
                : "hover:bg-white text-zinc-700 hover:text-zinc-900"
            }`}
            title="Скорость симуляции"
          >
            {simSpeed}x
          </button>

          <button
            onClick={() => onControl && onControl("reset")}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isDarkMode
                ? "hover:bg-white/10 text-zinc-300 hover:text-white"
                : "hover:bg-white text-zinc-700 hover:text-zinc-900"
            }`}
            title="Сбросить состояние"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Jury Guide Tour Button */}
        {onOpenGuide && (
          <button
            onClick={onOpenGuide}
            className={`h-8 px-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              isDarkMode
                ? "bg-[#222226] hover:bg-white/10 border-white/10 text-zinc-300 hover:text-white"
                : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-900"
            }`}
            title="Экскурсия по системе для жюри"
          >
            <Compass size={13} />
            <span className="hidden sm:inline">Гайд жюри</span>
          </button>
        )}

        {/* Theme Toggle (Dark/Light) */}
        {onToggleDarkMode && (
          <button
            onClick={onToggleDarkMode}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDarkMode
                ? "bg-[#222226] hover:bg-white/10 border-white/10 text-zinc-300 hover:text-white"
                : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-900"
            }`}
            title={isDarkMode ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
          >
            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        )}

        {/* Audio Mute Toggle */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer hidden sm:flex ${
            isDarkMode
              ? "bg-[#222226] hover:bg-white/10 border-white/10 text-zinc-300 hover:text-white"
              : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-900"
          }`}
          title={isMuted ? "Включить звуковые оповещения" : "Выключить звук"}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={handleToggleFullscreen}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer hidden md:flex ${
            isDarkMode
              ? "bg-[#222226] hover:bg-white/10 border-white/10 text-zinc-300 hover:text-white"
              : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700 hover:text-zinc-900"
          }`}
          title={isFullscreen ? "Выйти из полноэкранного режима" : "Во весь экран"}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </header>
  );
};
