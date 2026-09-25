import React from "react";
import {
  X,
  Maximize2,
  CheckCircle2,
  GitBranch,
  Gauge,
  Clock,
  MapPin,
  TrendingDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Vehicle, AlertItem } from "../mock/telemetry";

export interface InspectorProps {
  vehicle?: Vehicle | null;
  alert?: AlertItem | null;
  onApplyHolding?: (alertId: string) => void;
  onOpenScenarios?: () => void;
  onClose?: () => void;
  isDarkMode?: boolean;
}

export const Inspector: React.FC<InspectorProps> = ({
  vehicle,
  alert,
  onApplyHolding,
  onOpenScenarios,
  onClose,
  isDarkMode = true,
}) => {
  // Chart data
  const chartData = alert?.delayChartData?.length
    ? alert.delayChartData.map((d) => ({
        stop: d.stop,
        plan: d.plan,
        withoutAction: d.withoutAction,
        withHolding: d.withHolding,
      }))
    : [
        { stop: "Покровка", plan: 10, withoutAction: 15, withHolding: 15 },
        { stop: "Доброслободская", plan: 20, withoutAction: 45, withHolding: 30 },
        { stop: "м. Бауманская", plan: 30, withoutAction: 85, withHolding: 52 },
        { stop: "м. Семёновская", plan: 45, withoutAction: 145, withHolding: 58 },
      ];

  const recommendation = alert?.recommendation;
  const isApplied = recommendation?.applied || false;
  const alertId = alert?.id || "alert_1042";

  // SHAP factors
  const shapBars = alert?.shapFactors?.length
    ? alert.shapFactors.map((f, i) => ({
        code: ["BUR", "PHR", "SSR", "SRP", "CFD", "PET", "FHR"][i] || `F${i}`,
        height: Math.min(95, Math.max(15, f.percent * 1.4)),
        value: `+${f.delayMinutes.toFixed(1)}`,
        label: f.title,
      }))
    : [
        { code: "BUR", height: 85, value: "+0.42", label: "Затор перегона" },
        { code: "PHR", height: 60, value: "+0.28", label: "Посадка в дождь" },
        { code: "SSR", height: 45, value: "+0.20", label: "Светофор" },
        { code: "SRP", height: 35, value: "+0.15", label: "Интервал" },
        { code: "CFD", height: 25, value: "+0.10", label: "Пассажиропоток" },
        { code: "PET", height: 16, value: "+0.05", label: "Посадка ТПУ" },
        { code: "FHR", height: 10, value: "+0.03", label: "Маневры" },
      ];

  const vehicleCleanId = vehicle ? vehicle.id.replace(/^P/, "") : "1042";
  const vehicleTitle = `Электробус №${vehicleCleanId}`;
  const routeBadge = vehicle
    ? `${vehicle.routeId} (${vehicle.routeName.split("—")[0].trim()} ➔ ${vehicle.routeName.split("—")[1]?.trim() || "Лужники"})`
    : `${alert?.routeNumberBadge || "м3"} (Семёновская ➔ Лужники)`;

  const targetVehId = recommendation?.targetVehicleId || "№1043";
  const effectPercent = recommendation?.effectPercent || 96;
  const recText =
    recommendation?.text ||
    `Придержать лидер ${targetVehId} на остановке «м. Бауманская» на 2.5 мин.`;
  const recInfoText =
    recommendation?.infoText || "Интервал восстановится с 1.4 мин до 8.0 мин.";

  return (
    <aside
      className={`w-[360px] max-h-[calc(100vh-100px)] overflow-y-auto rounded-2xl border shadow-2xl p-4 flex flex-col gap-3.5 z-20 pointer-events-auto shrink-0 select-none scrollbar-thin backdrop-blur-xl transition-colors duration-200 ${
        isDarkMode
          ? "bg-[#101726]/95 border-slate-700/80 text-slate-200 shadow-black/60"
          : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-900/10"
      }`}
    >
      {/* 1. Header: Inspector Title and Controls */}
      <div
        className={`flex items-center justify-between pb-2 border-b ${
          isDarkMode ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-400"
        }`}
      >
        <div className="flex items-center gap-2">
          <GitBranch size={15} className={isDarkMode ? "text-cyan-400" : "text-emerald-600"} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            Инспектор СППР
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {onClose && (
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDarkMode ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200" : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              }`}
              title="Свернуть инспектор"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Unit Title, Route Badge, and Telemetry Grid */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {vehicleTitle}
          </h2>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              vehicle?.status === "BUNCHING_RISK" || alert?.category === "critical"
                ? isDarkMode
                  ? "bg-rose-900/60 text-rose-300 border border-rose-700/80"
                  : "bg-rose-100 text-rose-700"
                : isDarkMode
                ? "bg-amber-900/60 text-amber-300 border border-amber-700/80"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {vehicle?.status === "BUNCHING_RISK" ? "ПАЧКОВАНИЕ" : "РИСК СБОЯ"}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
              isDarkMode
                ? "bg-emerald-950/60 border-emerald-800/80 text-emerald-300"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            {routeBadge}
          </span>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
              isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
            }`}
          >
            {vehicle?.plateNumber || "В 042 АХ 777"}
          </span>
        </div>

        {/* Live Telemetry Metric Capsules */}
        <div className="grid grid-cols-3 gap-2 mt-1">
          <div
            className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center ${
              isDarkMode ? "bg-[#141C2E] border-slate-700/70" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Gauge size={12} className="text-cyan-400" />
              <span>Скорость</span>
            </div>
            <span className="text-xs font-black font-mono text-cyan-400">
              {vehicle?.speedKmh ?? 14} км/ч
            </span>
          </div>

          <div
            className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center ${
              isDarkMode ? "bg-[#141C2E] border-slate-700/70" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Clock size={12} className="text-rose-400" />
              <span>Задержка</span>
            </div>
            <span className="text-xs font-black font-mono text-rose-400">
              +{Math.round((vehicle?.delaySeconds ?? 180) / 60)} мин
            </span>
          </div>

          <div
            className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center ${
              isDarkMode ? "bg-[#141C2E] border-slate-700/70" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <MapPin size={12} className="text-emerald-400" />
              <span>Остановка</span>
            </div>
            <span className={`text-[11px] font-bold truncate max-w-full ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
              {vehicle?.nextStop || "м. Бауманская"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Recharts Trajectory comparison curve */}
      <div
        className={`rounded-xl border p-3.5 shadow-sm flex flex-col gap-2 ${
          isDarkMode ? "bg-[#141C2E] border-slate-700/80" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            Прогноз задержки (сек)
          </span>
          <div className="flex items-center gap-2 text-[10px] font-semibold">
            <span className="text-blue-400 flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-blue-500 inline-block" /> План
            </span>
            <span className="text-rose-400 flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-rose-500 inline-block" /> Без мер
            </span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-emerald-500 inline-block" /> Holding
            </span>
          </div>
        </div>

        <div className="h-32 w-full mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <XAxis dataKey="stop" tick={{ fontSize: 9, fill: isDarkMode ? "#64748b" : "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: isDarkMode ? "#64748b" : "#94a3b8" }} axisLine={false} tickLine={false} unit="с" />
              <Tooltip
                contentStyle={{
                  fontSize: "11px",
                  borderRadius: "8px",
                  backgroundColor: isDarkMode ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
                  borderColor: isDarkMode ? "#334155" : "#e2e8f0",
                  color: isDarkMode ? "#f8fafc" : "#0f172a",
                }}
              />
              <Line type="monotone" dataKey="plan" name="План" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="withoutAction" name="Без мер" stroke="#ef4444" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="withHolding" name="С Holding" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. SHAP factor breakdown */}
      <div
        className={`rounded-xl border p-3.5 shadow-sm flex flex-col gap-2 ${
          isDarkMode ? "bg-[#141C2E] border-slate-700/80" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            Факторный анализ (SHAP)
          </span>
          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
            isDarkMode ? "bg-slate-800 text-cyan-400" : "bg-slate-100 text-slate-600"
          }`}>
            CatBoost ML
          </span>
        </div>

        {/* Vertical Bar Chart */}
        <div className={`h-20 w-full flex items-end justify-between pt-2 px-1 border-b ${
          isDarkMode ? "border-slate-700/70" : "border-slate-200"
        }`}>
          {shapBars.map((bar) => (
            <div key={bar.code} className="flex flex-col items-center gap-1 group relative cursor-pointer" title={bar.label}>
              <span className={`text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 ${
                isDarkMode ? "text-cyan-300" : "text-slate-600"
              }`}>
                {bar.value}
              </span>
              <div
                className="w-5 rounded-t-sm bg-gradient-to-t from-blue-700 to-sky-400 transition-all group-hover:brightness-125"
                style={{ height: `${bar.height}%` }}
              />
            </div>
          ))}
        </div>

        {/* Bar Labels Row */}
        <div className={`flex justify-between px-1 text-[9px] font-mono font-bold ${
          isDarkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          {shapBars.map((bar) => (
            <span key={bar.code} className="w-5 text-center">
              {bar.code}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-700/50">
          <span className={isDarkMode ? "text-slate-300" : "text-slate-600"}>
            Ключевой фактор: <strong>{shapBars[0]?.label || "Затор"}</strong>
          </span>
          <span className="font-bold text-cyan-400">{shapBars[0]?.value || "+0.42"} мин</span>
        </div>
      </div>

      {/* 5. Holding Action CTA Box */}
      <div
        className={`rounded-xl border p-4 shadow-md flex flex-col gap-2.5 ${
          isDarkMode
            ? "border-emerald-700/80 bg-emerald-950/40"
            : "border-emerald-200 bg-emerald-50/60"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-black uppercase tracking-wider ${
            isDarkMode ? "text-emerald-300" : "text-emerald-900"
          }`}>
            СППР: Рекомендация Holding
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            isDarkMode ? "bg-emerald-900 text-emerald-200" : "bg-emerald-200 text-emerald-900"
          }`}>
            ЭФФЕКТ: {effectPercent}%
          </span>
        </div>

        <p className={`text-xs leading-relaxed ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
          {recText}
        </p>
        <span className={`text-[11px] font-medium ${isDarkMode ? "text-emerald-400" : "text-emerald-800"}`}>
          {recInfoText}
        </span>

        {/* Prominent Action Button */}
        <button
          onClick={() => !isApplied && onApplyHolding && onApplyHolding(alertId)}
          disabled={isApplied}
          className={`w-full h-11 px-4 rounded-xl text-white font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer ${
            isApplied
              ? "bg-emerald-800 cursor-default opacity-90"
              : "bg-[#00875A] hover:bg-[#00965E] active:scale-98 shadow-emerald-900/30"
          }`}
        >
          <CheckCircle2 size={16} />
          <span>
            {isApplied
              ? `✓ Команда передана на борт ${targetVehId}`
              : `✓ Применить Holding (${targetVehId})`}
          </span>
        </button>

        {/* Alternative Scenarios Button */}
        <button
          onClick={() => onOpenScenarios && onOpenScenarios()}
          className={`w-full h-9 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
            isDarkMode
              ? "border-emerald-600/80 bg-[#141C2E] hover:bg-slate-800 text-emerald-300"
              : "border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800"
          }`}
        >
          <span>⚡ Матрица сценариев СППР (4 варианта) ▾</span>
        </button>
      </div>
    </aside>
  );
};

export default Inspector;
