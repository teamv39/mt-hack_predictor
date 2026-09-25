import React from "react";
import {
  Settings,
  Search,
  SlidersHorizontal,
  Clock,
  X,
  MapPin,
  AlertTriangle,
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
    <aside className="w-[340px] xl:w-[360px] h-full flex flex-col bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden shrink-0 pointer-events-auto ring-1 ring-slate-900/5">
      {/* 1. Header with Settings Cog & Badge */}
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
            <Settings size={14} />
          </div>
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Центр инцидентов
          </h2>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80">
          3 затемнения
        </span>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="p-3 bg-white border-b border-slate-100 flex flex-col gap-2">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-3 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск маршрутов (12 линий...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400 font-medium"
          />
          <SlidersHorizontal size={13} className="absolute right-3 text-blue-600 cursor-pointer" />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveFilter("all")}
            className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
              activeFilter === "all"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Все (12)
          </button>
          <button
            onClick={() => setActiveFilter("critical")}
            className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
              activeFilter === "critical"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Критич. (3)
          </button>
          <button
            onClick={() => setActiveFilter("bunching")}
            className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
              activeFilter === "bunching"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Пачкование (2)
          </button>
        </div>
      </div>

      {/* 3. Predictive Alert Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {filteredAlerts.map((alert) => {
          const isSelected = alert.id === selectedAlertId;

          return (
            <div
              key={alert.id}
              onClick={() => onSelectAlert(alert)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                isSelected
                  ? "bg-blue-50/50 border-blue-500 shadow-md ring-2 ring-blue-500/20"
                  : "bg-slate-50/70 hover:bg-white border-slate-200/90 shadow-2xs hover:shadow-md"
              }`}
            >
              {/* Badge Strip */}
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {/* Clock / Urgency Badge */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100/90 text-amber-900 border border-amber-200/80">
                  <Clock size={11} className="text-amber-700" />
                  {alert.urgencyBadge}
                </span>

                {/* Route Badge */}
                <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-black text-[10px] border border-sky-200">
                  {alert.routeNumberBadge}
                </span>

                {/* Risk Tag */}
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    alert.tagType === "bunching"
                      ? "bg-rose-100 text-rose-800 border-rose-200"
                      : alert.tagType === "interval"
                      ? "bg-sky-100 text-sky-800 border-sky-200"
                      : "bg-teal-100 text-teal-800 border-teal-200"
                  }`}
                >
                  {alert.tag}
                </span>
              </div>

              {/* Title & Delay Header */}
              <div className="flex items-center justify-between gap-1">
                <h3 className="text-[13px] font-black text-slate-900 tracking-tight">
                  {alert.title}
                </h3>
                <span className="text-xs font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                  {alert.delayLabel}
                </span>
              </div>

              {/* Structured Incident Details (Clean separated box) */}
              <div className="my-2 p-2 rounded-lg bg-white/90 border border-slate-200/70 text-[11px] text-slate-600 leading-snug space-y-1">
                <div className="flex items-start gap-1.5">
                  <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                  <span className="font-semibold text-slate-700 truncate">{alert.locationName}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-slate-600 leading-snug">{alert.description}</span>
                </div>
              </div>

              {/* Neural Network Confidence Progress Bar */}
              <div className="pt-1.5 border-t border-slate-200/60">
                <div className="flex items-center justify-between text-[10px] mb-1 text-slate-600">
                  <span className="font-semibold text-slate-500">Уверенность нейросети</span>
                  <span className="font-black text-slate-900">{alert.confidence}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-900 rounded-full transition-all duration-500"
                    style={{ width: `${alert.confidence}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Bottom Status Strip */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600 font-medium">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold">Очередь событий активна</span>
        </div>
        <button className="text-slate-400 hover:text-slate-600">
          <X size={13} />
        </button>
      </div>
    </aside>
  );
};
