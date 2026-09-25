import React, { useState } from 'react';
import { 
  Activity, 
  Map, 
  Radio, 
  GitCommit, 
  Bus, 
  Clock, 
  AlertOctagon, 
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

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

export function TopBar({
  metrics,
  activeTab: activeTabProp,
  setActiveTab: setActiveTabProp,
  isSimPlaying,
  simSpeed,
  onControl,
}: TopBarProps = {}) {
  const [internalActiveTab, setInternalActiveTab] = useState('hall');

  const currentTab = activeTabProp ?? internalActiveTab;

  const handleTabChange = (tabId: string) => {
    setInternalActiveTab(tabId);
    if (setActiveTabProp) {
      setActiveTabProp(tabId);
    }
  };

  const navTabs = [
    { id: 'hall', label: 'Ситуационный зал', icon: Activity },
    { id: 'gis', label: 'ГИС Маршрутов', icon: Map },
    { id: 'telemetry', label: 'Телеметрия флота', icon: Radio },
    { id: 'intervals', label: 'Интервалограммы', icon: GitCommit },
  ];

  const vehiclesCount = metrics?.vehiclesOnLine ?? 412;
  const punctuality = metrics?.punctualityRate != null 
    ? `${metrics.punctualityRate.toFixed(1)}%` 
    : '94.8%';
  const incidentsCount = metrics?.activeIncidentsCount ?? 1;
  const preventedCount = metrics?.preventedIncidentsCount ?? 19;

  return (
    <header className="h-14 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 flex items-center justify-between z-30 select-none shadow-sm">
      
      {/* 1. БРЕНДИНГ И СТАТУС СИСТЕМЫ */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-sm shadow-blue-500/30">
            М
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 text-sm tracking-tight">Москтор 2.0</span>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200">
                PROD
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">ЦОДД / ДИТ Москвы</span>
          </div>
        </div>

        {/* Live-индикатор */}
        <div className="h-6 w-px bg-slate-200 mx-1" />
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[11px] font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>LIVE SIMULATION</span>
        </div>
      </div>

      {/* 2. НАВИГАЦИОННЫЕ ВКЛАДКИ (СЕГМЕНТИРОВАННЫЙ ТАБ-БАР) */}
      <nav className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id || currentTab === tab.label;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Icon className={isActive ? 'text-blue-600' : 'text-slate-400'} size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 3. ОПЕРАТИВНЫЕ МЕТРИКИ (KPI CHIPS) */}
      <div className="flex items-center gap-2">
        {/* Бортов на линии */}
        <div className="h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs">
          <Bus className="text-slate-400" size={14} />
          <span className="text-[11px] text-slate-500 font-medium">Бортов:</span>
          <span className="font-extrabold text-slate-900">{vehiclesCount}</span>
        </div>

        {/* Пунктуальность */}
        <div className="h-8 px-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center gap-2 text-xs">
          <Clock className="text-emerald-600" size={14} />
          <span className="text-[11px] text-emerald-800 font-medium">Пунктуальность:</span>
          <span className="font-extrabold text-emerald-700">{punctuality}</span>
        </div>

        {/* Активные инциденты */}
        <div className="h-8 px-2.5 rounded-lg bg-rose-50/80 border border-rose-200 flex items-center gap-2 text-xs">
          <AlertOctagon className="text-rose-600" size={14} />
          <span className="text-[11px] text-rose-800 font-medium">Инциденты:</span>
          <span className="font-extrabold text-rose-700">{incidentsCount}</span>
        </div>

        {/* Предотвращено */}
        <div className="h-8 px-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200 flex items-center gap-2 text-xs">
          <ShieldCheck className="text-indigo-600" size={14} />
          <span className="text-[11px] text-indigo-800 font-medium">Спасены:</span>
          <span className="font-extrabold text-indigo-700">{preventedCount}</span>
        </div>

        {/* Кнопка сброса/старта симуляции */}
        <div className="h-6 w-px bg-slate-200 mx-1" />
        <button 
          title="Перезапустить поток"
          onClick={() => {
            if (onControl) {
              onControl("step", "+10 мин");
            }
          }}
          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 flex items-center justify-center transition-all border border-slate-200/80 cursor-pointer"
        >
          <RotateCcw size={14} />
        </button>
      </div>

    </header>
  );
}

export default TopBar;
