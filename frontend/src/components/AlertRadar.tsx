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
    <aside className="w-[360px] h-full max-h-[calc(100vh-100px)] bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col pointer-events-auto shrink-0">
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
      <div className="p-3 flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-160px)] scrollbar-thin">
        {filteredAlerts.map((alert) => {
          const isSelected = alert.id === selectedAlertId;

          return (
            <div
              key={alert.id}
              onClick={() => onSelectAlert(alert)}
              className={
                isSelected
                  ? "bg-[#fff8f5] border border-amber-200/80 border-l-4 border-l-rose-500 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer"
                  : "bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
              }
            >
              {/* Row 1: Badges matching reference */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {/* Urgency Badge (Orange pill) */}
                <span className="bg-[#ffe8d6] text-[#b45309] font-bold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                  <Clock size={12} className="text-[#b45309]" />
                  <span>{alert.urgencyBadge}</span>
                </span>

                {/* Route Number Badge (Blue pill) */}
                <span className="bg-[#e0f2fe] text-[#0369a1] font-bold text-xs px-2.5 py-1 rounded-lg shrink-0">
                  {alert.routeNumberBadge}
                </span>

                {/* Incident Tag Badge (Pink pill for bunching, sky for interval, emerald for compression) */}
                <span
                  className={`font-semibold text-xs px-2.5 py-1 rounded-lg shrink-0 ${
                    alert.tagType === "bunching"
                      ? "bg-[#fee2e2] text-[#b91c1c]"
                      : alert.tagType === "interval"
                      ? "bg-[#e0f2fe] text-[#0369a1]"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {alert.tag}
                </span>
              </div>

              {/* Row 2: Vehicle Title + Red Delay Status */}
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">{alert.title}</span>
                <span className="text-xs font-bold text-rose-600">{alert.delayLabel}</span>
              </div>

              {/* Row 3: Description */}
              <p className="text-xs text-slate-600 leading-snug my-2 line-clamp-2">
                {alert.description}
              </p>

              {/* Row 4: Neural Confidence Progress Bar */}
              <div className="mt-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Уверенность нейросети</span>
                  <span className="font-bold text-slate-900">{alert.confidence}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="bg-[#0f172a] h-full rounded-full transition-all duration-500"
                    style={{ width: `${alert.confidence}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Bottom Status Strip */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600 font-medium mt-auto">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-slate-700">Очередь событий активна</span>
        </div>
        <button className="text-slate-400 hover:text-slate-600">
          <X size={13} />
        </button>
      </div>
    </aside>
  );
};
