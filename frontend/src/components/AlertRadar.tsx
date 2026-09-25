import React, { useState } from "react";
import {
  AlertTriangle,
  MoreHorizontal,
  ChevronDown,
  Search,
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
  const [activeTab, setActiveTab] = useState<"alerts" | "analytics">("alerts");

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
    <aside className="w-[360px] h-full max-h-[calc(100vh-90px)] bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col pointer-events-auto shrink-0 select-none">
      {/* 1. Header: Red Dot + AlertRadar + Badge + More Menu */}
      <div className="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
            AlertRadar
          </h2>
          <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-extrabold text-[10px]">
            {alerts.length}
          </span>
        </div>
        <button
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          title="Параметры радара"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* 2. Tabs: Текущие алерты | Аналитика ML */}
      <div className="flex h-10 border-b border-slate-200 bg-slate-50 shrink-0 text-xs">
        <button
          onClick={() => setActiveTab("alerts")}
          className={`flex-1 flex items-center justify-center gap-1.5 font-bold transition-all relative ${
            activeTab === "alerts"
              ? "text-emerald-800 bg-white"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>Текущие алерты</span>
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
            {alerts.length}
          </span>
          {activeTab === "alerts" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex-1 flex items-center justify-center font-semibold transition-all relative ${
            activeTab === "analytics"
              ? "text-emerald-800 bg-white font-bold"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>Аналитика ML</span>
          {activeTab === "analytics" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
          )}
        </button>
      </div>

      {/* 3. Search and Category Filter Chips */}
      <div className="p-3 bg-white flex flex-col gap-2 shrink-0 border-b border-slate-100">
        <div className="relative flex items-center h-8">
          <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск по бортам и маршрутам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-7 pr-3 text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder-slate-400 font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 h-6">
          <button
            onClick={() => setActiveFilter("all")}
            className={`h-6 px-2 rounded text-[10px] font-bold transition-all flex items-center justify-center ${
              activeFilter === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Все ({alerts.length})
          </button>
          <button
            onClick={() => setActiveFilter("critical")}
            className={`h-6 px-2 rounded text-[10px] font-bold transition-all flex items-center justify-center ${
              activeFilter === "critical"
                ? "bg-rose-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Критич. ({alerts.filter((a) => a.category === "critical").length})
          </button>
          <button
            onClick={() => setActiveFilter("bunching")}
            className={`h-6 px-2 rounded text-[10px] font-bold transition-all flex items-center justify-center ${
              activeFilter === "bunching"
                ? "bg-amber-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Пачкование ({alerts.filter((a) => a.category === "bunching").length})
          </button>
        </div>
      </div>

      {/* 4. Alert Cards List */}
      <div className="flex-1 p-2.5 overflow-y-auto flex flex-col gap-2.5">
        {filteredAlerts.map((item) => {
          const isSelected = item.id === selectedAlertId;
          const isHigh = item.tagType === "bunching" || item.category === "critical";

          return (
            <div
              key={item.id}
              onClick={() => onSelectAlert(item)}
              className={`rounded-xl p-3 cursor-pointer transition-all ${
                isSelected
                  ? "border-2 border-[#DA251D] bg-rose-50/30 shadow-xs"
                  : "border border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
              }`}
            >
              {/* Card Header: Icon + Title + Severity Badge */}
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle
                    size={14}
                    className={isHigh ? "text-rose-600 shrink-0" : "text-amber-500 shrink-0"}
                  />
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {item.tagType === "bunching"
                      ? "Пачкование м3 (Bunching)"
                      : item.tagType === "interval"
                      ? "Срыв интервала т17"
                      : "Сжатие интервала е30"}
                  </span>
                </div>
                <span
                  className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                    isHigh ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {isHigh ? "HIGH" : "MEDIUM"}
                </span>
              </div>

              {/* Description */}
              <p className="text-[11px] text-slate-600 leading-snug mb-2">
                {item.id === "alert_1042"
                  ? "Борт №1042 догоняет лидера №1043 на перегоне м. Бауманская. Текущий интервал 1.4 мин (норма: 8 мин)."
                  : item.id === "alert_2198"
                  ? "Борт №2198, затор на Покровке / Мосфильмовская. Опоздание от расписания: +9 мин."
                  : "Борт №0814, интервал сократился до 1.5 мин на радиусе ТТК Юго-Запад."}
              </p>

              {/* Footer metrics line */}
              <div className="flex items-center justify-between text-[10px] font-mono pt-1.5 border-t border-slate-100">
                <span className={isHigh ? "text-rose-600 font-bold" : "text-amber-700 font-bold"}>
                  {item.id === "alert_1042"
                    ? "Риск CatBoost: 89.4%"
                    : item.id === "alert_2198"
                    ? "Затор: 7 баллов"
                    : "Уверенность ML: 94%"}
                </span>
                <span className="text-slate-500 font-semibold">
                  {item.id === "alert_1042"
                    ? "+14 мин задержки"
                    : item.id === "alert_2198"
                    ? "T+18 мин прогноз"
                    : "Критично"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Footer: Real-time monitoring note */}
      <div className="p-2.5 bg-slate-50/80 border-t border-slate-200/80 text-[10px] font-medium text-slate-500 text-center shrink-0">
        Мониторинг 48 электробусных маршрутов в реальном времени
      </div>
    </aside>
  );
};

export default AlertRadar;
