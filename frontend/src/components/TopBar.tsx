import React from "react";
import {
  Play,
  Pause,
  Layers,
  Radio,
  ArrowRight,
  Bus,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  PieChart,
} from "lucide-react";
import { MOCK_SYSTEM_METRICS } from "../mock/telemetry";

interface TopBarProps {
  metrics: typeof MOCK_SYSTEM_METRICS;
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
  return (
    <div className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 z-30 select-none shadow-2xs">
      {/* Upper Header Row */}
      <div className="h-14 px-4 flex items-center justify-between gap-3">
        {/* Left Section: Logo & Branding & Navigation Tabs */}
        <div className="flex items-center gap-3">
          {/* Moscow Transport Red Icon */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white shadow-sm font-bold text-xs">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7a5 5 0 1 0 5 5" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-[12px] font-black text-slate-900 tracking-tight uppercase">
                Московский транспорт
              </div>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-bold text-emerald-600 tracking-wider">
                  LIVE SIMULATION
                </span>
              </div>
            </div>
          </div>

          <div className="h-7 w-[1px] bg-slate-200 mx-1" />

          {/* Sub-brand / Organization */}
          <div className="leading-tight pr-2">
            <div className="text-[12px] font-bold text-slate-800">Москтор 2.0</div>
            <div className="text-[10px] text-slate-500 font-medium">ЦОДД / ДИТ Москва</div>
          </div>

          {/* Navigation Tabs matching screenshot */}
          <nav className="flex items-center gap-1.5 ml-2">
            {/* Active Tab: Ситуационный зал */}
            <button
              onClick={() => setActiveTab("Ситуационный зал")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-sm shadow-blue-500/20"
            >
              <Sparkles size={13} />
              <span>Ситуационный зал</span>
            </button>

            {/* Inactive Tab: ГИС Маршрутов */}
            <button
              onClick={() => setActiveTab("ГИС Маршрутов")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold text-xs transition-colors"
            >
              <Layers size={14} className="text-slate-500" />
              <span>ГИС Маршрутов</span>
            </button>

            {/* Inactive Tab: Телеметрия флота */}
            <button
              onClick={() => setActiveTab("Телеметрия флота")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold text-xs transition-colors"
            >
              <Radio size={14} className="text-slate-500" />
              <span>Телеметрия флота</span>
            </button>

            {/* Inactive Tab: Интервалограммы */}
            <button
              onClick={() => setActiveTab("Интервалограммы")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold text-xs transition-colors"
            >
              <ArrowRight size={13} className="text-slate-500" />
              <span>Интервалограммы</span>
            </button>
          </nav>
        </div>

        {/* Right Section: Metric Chips & Controls matching screenshot */}
        <div className="flex items-center gap-2">
          {/* Card 1: Бортов на линии */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <Bus size={14} className="text-slate-600" />
            <div className="leading-none">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Бортов на линии</div>
              <div className="text-xs font-black text-slate-900 mt-0.5">{metrics.vehiclesOnLine}</div>
            </div>
          </div>

          {/* Card 2: Пунктуальность 94.8% */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800">
            <PieChart size={13} className="text-emerald-600" />
            <span className="text-[11px] font-medium text-emerald-700">Пунктуальность</span>
            <span className="text-xs font-black text-emerald-700 ml-0.5">{metrics.punctualityRate.toFixed(1)}%</span>
          </div>

          {/* Card 3: Активные инциденты 3 */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200/90 text-rose-800">
            <AlertTriangle size={13} className="text-rose-600" />
            <span className="text-[11px] font-bold text-rose-700 uppercase">Активные инциденты</span>
            <span className="text-xs font-black text-rose-800 ml-0.5">{metrics.activeIncidentsCount}</span>
          </div>

          {/* Card 4: Предотвращено сбоев 19 */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Предотвращено сбоев</span>
            <span className="text-xs font-black text-emerald-800 ml-0.5">{metrics.preventedIncidentsCount}</span>
          </div>

          {/* Controls: Play/Pause, 10, 15, x5, x10 */}
          <div className="flex items-center gap-1 pl-1">
            <button
              onClick={() => onControl(isSimPlaying ? "pause" : "play")}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Пауза / Пуск"
            >
              {isSimPlaying ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <button
              onClick={() => onControl("step", "+10 мин")}
              className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              10
            </button>
            <button
              onClick={() => onControl("step", "+15 мин")}
              className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              15
            </button>
            <button
              onClick={() => onControl("speed", 5)}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                simSpeed === 5 ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              x5
            </button>
            <button
              onClick={() => onControl("speed", 10)}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                simSpeed === 10 ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              x10
            </button>
          </div>
        </div>
      </div>

      {/* Subheader Strip: ПРЕДИКТИВНЫЙ РАДАР, МОДЕЛЬ RT-NEURAL, Горизонт, MAE, Сектор мониторинга */}
      <div className="h-8 px-4 bg-slate-50/90 border-t border-slate-200/70 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          {/* Red Dot + ПРЕДИКТИВНЫЙ РАДАР */}
          <div className="flex items-center gap-1.5 font-black text-rose-600 text-[11px] tracking-wide uppercase">
            <span className="w-2 h-2 rounded-full bg-rose-600 inline-block"></span>
            <span>Предиктивный радар</span>
          </div>

          {/* Model Badge */}
          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-bold text-[10px]">
            МОДЕЛЬ {metrics.modelVersion}
          </span>

          {/* Simulation Horizon */}
          <span className="text-slate-600 text-[11px]">
            Горизонт симуляции: <strong className="text-slate-900 font-black">{metrics.simulationHorizon}</strong>
          </span>

          {/* MAE Accuracy */}
          <span className="text-slate-600 text-[11px]">
            MAE точность: <strong className="text-emerald-600 font-bold">{metrics.maeAccuracy}</strong>
          </span>
        </div>

        {/* Right sub-bar items */}
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-slate-500 font-medium">
            СЕКТОР МОНИТОРИНГА: <strong className="text-slate-700">{metrics.sector}</strong>
          </span>
          <span className="font-mono text-[10px] text-emerald-600 font-bold">
            EBT: {metrics.ebt} | FPS: {metrics.fps}
          </span>
        </div>
      </div>
    </div>
  );
};
