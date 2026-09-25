import React from "react";
import {
  Settings,
  Search,
  SlidersHorizontal,
  Clock,
  X,
} from "lucide-react";
import { AlertItem } from "../mock/telemetry";

interface AlertRadarProps {
  alerts: AlertItem[];
  selectedAlertId: string;
  onSelectAlert: (alert: AlertItem) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilter: "all" | "critical" | "bunching";
  setActiveFilter: (filter: "all" | "critical" | "bunching") => void;
}

export const AlertRadar: React.FC<AlertRadarProps> = ({
  alerts,
  selectedAlertId,
  onSelectAlert,
  searchQuery,
  setSearchQuery,
  activeFilter,
  setActiveFilter,
}) => {
  const filteredAlerts = alerts.filter((item) => {
    const matchesSearch =
      item.routeNumberBadge.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeFilter === "critical") return item.category === "critical";
    if (activeFilter === "bunching") return item.category === "bunching";
    return true;
  });

  return (
    <aside className="w-[340px] xl:w-[360px] m-3 bg-white/90 backdrop-blur-md shadow-xl border border-slate-200/80 rounded-2xl max-h-[calc(100vh-140px)] flex flex-col overflow-hidden shrink-0 z-20 pointer-events-auto">
      {/* 1. Header with Settings Cog & 3 затемнения badge */}
      <div className="px-3.5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-rose-500" />
          <h2 className="text-xs font-black text-slate-900 tracking-tight">
            Центр инцидентов
          </h2>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/70">
          3 затемнения
        </span>
      </div>

      {/* 2. Search Input with Filter Sliders Icon */}
      <div className="px-3.5 pt-2.5 pb-2">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск маршрутов (12 линий...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-slate-800 placeholder-slate-400"
          />
          <SlidersHorizontal size={13} className="absolute right-2.5 text-blue-500 cursor-pointer" />
        </div>
      </div>

      {/* 3. Filter Buttons: Все (12), Критич. (3), Пачкование (2) */}
      <div className="px-3.5 pb-2.5 flex items-center gap-1.5 border-b border-slate-100">
        <button
          onClick={() => setActiveFilter("all")}
          className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
            activeFilter === "all"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200/70"
          }`}
        >
          Все (12)
        </button>
        <button
          onClick={() => setActiveFilter("critical")}
          className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
            activeFilter === "critical"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200/70"
          }`}
        >
          Критич. (3)
        </button>
        <button
          onClick={() => setActiveFilter("bunching")}
          className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
            activeFilter === "bunching"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200/70"
          }`}
        >
          Пачкование (2)
        </button>
      </div>

      {/* 4. Predictive Alert Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
        {filteredAlerts.map((alert) => {
          const isSelected = alert.id === selectedAlertId;

          return (
            <div
              key={alert.id}
              onClick={() => onSelectAlert(alert)}
              className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                isSelected
                  ? "bg-white border-blue-400 shadow-md ring-1 ring-blue-400/20"
                  : "bg-white hover:bg-slate-50/70 border-slate-200/80 shadow-2xs"
              }`}
            >
              {/* Badge Strip */}
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {/* Clock / Urgency Badge */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100/80 text-amber-900 border border-amber-200/60">
                  <Clock size={11} className="text-amber-700" />
                  {alert.urgencyBadge}
                </span>

                {/* Route Badge */}
                <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-black text-[10px] border border-sky-200/70">
                  {alert.routeNumberBadge}
                </span>

                {/* Risk Tag */}
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    alert.tagType === "bunching"
                      ? "bg-rose-100/90 text-rose-800 border-rose-200"
                      : alert.tagType === "interval"
                      ? "bg-sky-100/90 text-sky-800 border-sky-200"
                      : "bg-teal-100/90 text-teal-800 border-teal-200"
                  }`}
                >
                  {alert.tag}
                </span>
              </div>

              {/* Title & Delay Header */}
              <div className="flex items-center justify-between gap-1">
                <h3 className="text-xs font-black text-slate-900">{alert.title}</h3>
                <span className="text-xs font-black text-rose-700">{alert.delayLabel}</span>
              </div>

              {/* Description Text matching screenshot */}
              <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                {alert.description}
              </p>

              {/* Neural Network Confidence Progress Bar */}
              <div className="mt-2.5 pt-1.5 border-t border-slate-100">
                <div className="flex items-center justify-between text-[10px] mb-1 text-slate-600">
                  <span className="font-medium">Уверенность нейросети</span>
                  <span className="font-bold text-slate-900">{alert.confidence}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-800 rounded-full transition-all duration-500"
                    style={{ width: `${alert.confidence}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Bottom Status Strip matching screenshot */}
      <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
          <span>Очередь событий активна</span>
        </div>
        <button className="text-slate-400 hover:text-slate-600">
          <X size={12} />
        </button>
      </div>
    </aside>
  );
};
