import React from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  Activity,
  Layers,
  Radio,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Bus,
} from "lucide-react";

interface TopBarProps {
  metrics: {
    vehiclesOnLine: number;
    punctualityRate: number;
    activeIncidentsCount: number;
    preventedIncidentsCount: number;
    modelVersion: string;
    engineLatencyMs: number;
  };
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSimPlaying: boolean;
  simSpeed: number;
  onControl: (action: "play" | "pause" | "speed" | "step", value?: number | string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  metrics,
  activeTab,
  setActiveTab,
  isSimPlaying,
  simSpeed,
  onControl,
}) => {
  const tabs = [
    { id: "Ситуационный зал", icon: Activity },
    { id: "ГИС Маршрутов", icon: Layers },
    { id: "Телеметрия флота", icon: Radio },
    { id: "Интервалограммы", icon: Clock },
  ];

  return (
    <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200/90 shadow-sm z-30 px-4 py-2.5 flex items-center justify-between gap-4 transition-all">
      {/* Brand & Live Neural Indicator */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Moscow Transport Red Diamond/Circle Icon */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-red-500/20 font-black text-sm tracking-tight">
            МТ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none">
                Московский транспорт
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200/70">
                {metrics.modelVersion}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                  LIVE SIMULATION
                </span>
              </div>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] text-slate-500 font-medium">
                Ядро: {metrics.engineLatencyMs.toFixed(1)} мс
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 ml-4 pl-4 border-l border-slate-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon size={14} className={isActive ? "text-blue-400" : "text-slate-400"} />
                <span>{tab.id}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Real-time System Metric Chips */}
      <div className="flex items-center gap-2 xl:gap-3 overflow-x-auto py-0.5 scrollbar-none">
        {/* Fleet on line */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs shrink-0">
          <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
            <Bus size={13} />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] text-slate-500 font-medium">Бортов на линии</div>
            <div className="text-xs font-bold text-slate-800">{metrics.vehiclesOnLine}</div>
          </div>
        </div>

        {/* Punctuality Rate */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 shadow-xs shrink-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">
            %
          </div>
          <div className="leading-tight">
            <div className="text-[10px] text-emerald-700 font-medium">Пунктуальность</div>
            <div className="text-xs font-bold text-emerald-600">{metrics.punctualityRate.toFixed(1)}%</div>
          </div>
        </div>

        {/* Active Incidents */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50/80 border border-rose-200/90 shadow-xs shrink-0">
          <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
            <AlertTriangle size={13} />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] text-rose-700 font-medium">Активных инцидентов</div>
            <div className="text-xs font-bold text-rose-600">{metrics.activeIncidentsCount}</div>
          </div>
        </div>

        {/* Prevented incidents */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 shadow-xs shrink-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <ShieldCheck size={13} />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] text-emerald-700 font-medium">Предотвращено сбоев</div>
            <div className="text-xs font-bold text-emerald-600">{metrics.preventedIncidentsCount}</div>
          </div>
        </div>
      </div>

      {/* Simulation Controls Strip */}
      <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shrink-0">
        <button
          onClick={() => onControl(isSimPlaying ? "pause" : "play")}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
            isSimPlaying
              ? "bg-white text-slate-800 hover:bg-slate-50 border border-slate-200/60"
              : "bg-emerald-500 text-white hover:bg-emerald-600"
          }`}
          title={isSimPlaying ? "Приостановить симуляцию" : "Запустить симуляцию"}
        >
          {isSimPlaying ? <Pause size={13} /> : <Play size={13} />}
          <span className="hidden sm:inline">{isSimPlaying ? "Пауза" : "Пуск"}</span>
        </button>

        {/* Speed presets: > 10, 15, x5, x10 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onControl("step", "+10 мин")}
            className="px-2 py-1 text-xs font-semibold rounded-md text-slate-600 hover:text-slate-900 hover:bg-white transition-all"
            title="Перемотка на +10 минут вперед"
          >
            &gt; 10
          </button>
          <button
            onClick={() => onControl("step", "+15 мин")}
            className="px-2 py-1 text-xs font-semibold rounded-md text-slate-600 hover:text-slate-900 hover:bg-white transition-all"
            title="Перемотка на +15 минут вперед"
          >
            15
          </button>
          <button
            onClick={() => onControl("speed", 5)}
            className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${
              simSpeed === 5
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
            title="Скорость x5"
          >
            x5
          </button>
          <button
            onClick={() => onControl("speed", 10)}
            className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${
              simSpeed === 10
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
            title="Скорость x10"
          >
            x10
          </button>
        </div>
      </div>
    </header>
  );
};
