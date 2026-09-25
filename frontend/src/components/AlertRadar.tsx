import React from "react";
import {
  Search,
  AlertTriangle,
  Clock,
  ShieldCheck,
  MapPin,
  ChevronRight,
  TrendingDown,
  Sparkles,
  Filter,
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
  // Filter alerts by search query and category
  const filteredAlerts = alerts.filter((item) => {
    const matchesSearch =
      item.routeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.locationName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeFilter === "critical") return item.urgencyLevel === "critical";
    if (activeFilter === "bunching") return item.type === "bunching";
    return true;
  });

  return (
    <aside className="w-[340px] xl:w-[360px] h-full flex flex-col bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-lg overflow-hidden shrink-0 z-20 pointer-events-auto">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
            <AlertTriangle size={15} />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Центр инцидентов
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">
              Предиктивный радар аномалий
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/80">
          {filteredAlerts.length} инцидента
        </span>
      </div>

      {/* Search Input */}
      <div className="px-3.5 pt-3 pb-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Поиск по маршруту, остановке или борту..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Filters: Все (12), Критич. (3), Пачкование (2) */}
      <div className="px-3.5 pb-2.5 flex items-center gap-1.5 border-b border-slate-100">
        <button
          onClick={() => setActiveFilter("all")}
          className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
            activeFilter === "all"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70"
          }`}
        >
          Все (12)
        </button>
        <button
          onClick={() => setActiveFilter("critical")}
          className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
            activeFilter === "critical"
              ? "bg-rose-600 text-white shadow-xs"
              : "bg-rose-50 text-rose-700 hover:bg-rose-100/80 border border-rose-200/60"
          }`}
        >
          Критич. (3)
        </button>
        <button
          onClick={() => setActiveFilter("bunching")}
          className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all text-center ${
            activeFilter === "bunching"
              ? "bg-orange-600 text-white shadow-xs"
              : "bg-orange-50 text-orange-700 hover:bg-orange-100/80 border border-orange-200/60"
          }`}
        >
          Пачкование (2)
        </button>
      </div>

      {/* Predictive Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center text-slate-400">
            <ShieldCheck size={36} className="text-emerald-500 mb-2 opacity-80" />
            <p className="text-xs font-semibold text-slate-700">Инциденты не найдены</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              По заданным фильтрам сбоев в движении не прогнозируется.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isSelected = alert.id === selectedAlertId;
            const isApplied = alert.recommendation.applied;

            return (
              <div
                key={alert.id}
                onClick={() => onSelectAlert(alert)}
                className={`group p-3 rounded-xl border transition-all cursor-pointer text-left relative ${
                  isSelected
                    ? "bg-blue-50/50 border-blue-500 shadow-md ring-1 ring-blue-500/20"
                    : "bg-white hover:bg-slate-50/80 border-slate-200/80 hover:border-slate-300 shadow-xs"
                }`}
              >
                {/* Top Badge Strip: Urgency + Tag */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    {/* Urgency Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        isApplied
                          ? "bg-emerald-100 text-emerald-800"
                          : alert.urgencyLevel === "critical"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      <Clock size={11} />
                      {isApplied ? "РЕКОМЕНДАЦИЯ АКТИВНА" : alert.urgencyBadge}
                    </span>

                    {/* Tag */}
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        alert.type === "bunching"
                          ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {alert.tag}
                    </span>
                  </div>

                  <span className="text-[11px] font-black text-slate-400">
                    {alert.routeId}
                  </span>
                </div>

                {/* Card Title */}
                <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {alert.title}
                </h3>

                {/* Description */}
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed line-clamp-2">
                  {alert.description}
                </p>

                {/* Confidence Progress Bar */}
                <div className="mt-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Sparkles size={11} className="text-blue-500" />
                      Уверенность нейросети:
                    </span>
                    <span className="font-bold text-slate-800">
                      {alert.confidence}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        alert.confidence >= 90
                          ? "bg-gradient-to-r from-blue-500 to-indigo-600"
                          : "bg-gradient-to-r from-amber-400 to-orange-500"
                      }`}
                      style={{ width: `${alert.confidence}%` }}
                    />
                  </div>
                </div>

                {/* Location & Action Link */}
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1 truncate max-w-[200px]">
                    <MapPin size={11} className="text-slate-400 shrink-0" />
                    <span className="truncate">{alert.locationName}</span>
                  </span>

                  <span
                    className={`flex items-center gap-0.5 text-[10px] font-bold ${
                      isSelected ? "text-blue-600" : "text-slate-400 group-hover:text-blue-500"
                    }`}
                  >
                    К инциденту
                    <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
