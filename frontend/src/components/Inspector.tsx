import React from "react";
import {
  X,
  Maximize2,
  CheckCircle2,
  GitBranch,
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
  onClose?: () => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  vehicle,
  alert,
  onApplyHolding,
  onClose,
}) => {
  const chartData = [
    { sec: 0, plan: 10, fact: 10 },
    { sec: 100, plan: 38, fact: 20 },
    { sec: 200, plan: 68, fact: 35 },
    { sec: 300, plan: 95, fact: 50 },
    { sec: 400, plan: 125, fact: 60 },
  ];

  const recommendation = alert?.recommendation;
  const isApplied = recommendation?.applied || false;
  const alertId = alert?.id || "alert_1042";

  // SHAP feature breakdown bars
  const shapBars = [
    { code: "BUR", height: 85, value: "+0.42", label: "Затор перегона" },
    { code: "PHR", height: 60, value: "+0.28", label: "Посадка в дождь" },
    { code: "SSR", height: 45, value: "+0.20", label: "Светофор" },
    { code: "SRP", height: 35, value: "+0.15", label: "Интервал" },
    { code: "CFD", height: 25, value: "+0.10", label: "Пассажиропоток" },
    { code: "PET", height: 16, value: "+0.05", label: "Посадка ТПУ" },
    { code: "FHR", height: 10, value: "+0.03", label: "Маневры" },
  ];

  const vehicleTitle = vehicle ? `Электробус '${vehicle.id}'` : "Электробус '№1042'";
  const routeBadge = vehicle
    ? `${vehicle.routeId} (${vehicle.routeName.split("—")[0].trim()} ➔ ${vehicle.routeName.split("—")[1]?.trim() || "Лужники"})`
    : "м3 (Семёновская ➔ Лужники)";

  return (
    <aside className="w-[380px] max-h-[calc(100vh-90px)] overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xl p-4 flex flex-col gap-3 z-20 pointer-events-auto shrink-0 select-none scrollbar-thin">
      {/* 1. Header: Inspector card with expand and close */}
      <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <GitBranch size={14} className="text-emerald-600" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Inspector card
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Развернуть карточку"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Закрыть"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 2. Unit Title and Badges */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            {vehicleTitle}
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase tracking-wide">
            КРИТИЧНО
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] font-bold">
            {routeBadge}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 mt-0.5">
          ЛиАЗ-6274 • Телеметрия ЭРА-ГЛОНАСС и ML CatBoost
        </p>
      </div>

      {/* 3. Recharts Trajectory comparison curve */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-900">
            Кривая траектории (Recharts)
          </span>
          <div className="flex items-center gap-2 text-[10px] font-semibold">
            <span className="text-blue-600 flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-blue-600 inline-block" /> План
            </span>
            <span className="text-emerald-700 flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-emerald-600 inline-block" /> Факт/Прогноз
            </span>
          </div>
        </div>

        <span className="text-[10px] text-slate-400 font-mono -mt-1">
          Trajectory comparison curve (секунды отставания)
        </span>

        <div className="h-28 w-full mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <XAxis dataKey="sec" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 150]} ticks={[0, 50, 100, 150]} tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  fontSize: "11px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  borderColor: "#e2e8f0",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
              />
              <Line type="monotone" dataKey="plan" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="fact" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. SHAP factor breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-900">
            Факторный анализ (SHAP values)
          </span>
          <span className="text-[9px] font-bold font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            Модель: Elecor ML v4.2
          </span>
        </div>

        <span className="text-[10px] text-slate-400 -mt-1">
          Влияние внешних факторов на возникновение пачкования
        </span>

        {/* Vertical Bar Chart */}
        <div className="h-24 w-full flex items-end justify-between pt-2 px-1 border-b border-slate-200">
          {shapBars.map((bar) => (
            <div key={bar.code} className="flex flex-col items-center gap-1 group relative cursor-pointer">
              <span className="text-[9px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4">
                {bar.value}
              </span>
              <div
                className="w-5 rounded-t-sm bg-gradient-to-t from-blue-700 to-sky-400 transition-all group-hover:brightness-110"
                style={{ height: `${bar.height}%` }}
              />
            </div>
          ))}
        </div>

        {/* Bar Labels Row */}
        <div className="flex justify-between px-1 text-[9px] font-mono font-bold text-slate-500">
          {shapBars.map((bar) => (
            <span key={bar.code} className="w-5 text-center">
              {bar.code}
            </span>
          ))}
        </div>

        {/* Top Factor Highlight */}
        <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
          <span className="text-slate-600 font-medium">Ключевой фактор: <strong>Затор перегона (BUR)</strong></span>
          <span className="font-bold text-blue-700">Влияние: 42%</span>
        </div>
      </div>

      {/* 5. Holding Action CTA Box */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 shadow-2xs flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-wide">
            Headway Holding Action
          </span>
          <span className="px-1.5 py-0.2 rounded bg-emerald-200/80 text-emerald-900 text-[10px] font-extrabold">
            ЭФФЕКТ: 96%
          </span>
        </div>

        <p className="text-[11px] text-slate-700 leading-snug">
          Придержать ведущий следом лидер <strong>№1043</strong> на остановке «м. Бауманская» на <strong>2.5 минуты</strong>.
        </p>

        {/* Large Prominent Green Button */}
        <button
          onClick={() => !isApplied && onApplyHolding && onApplyHolding(alertId)}
          disabled={isApplied}
          className={`w-full py-3 px-4 rounded-xl text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer ${
            isApplied
              ? "bg-emerald-800 cursor-default"
              : "bg-[#00875A] hover:bg-[#00965E] active:scale-95 shadow-emerald-900/20"
          }`}
        >
          <CheckCircle2 size={16} />
          <span>
            {isApplied ? "✓ Команда передана на борт №1043" : "✓ Применить Holding / Задержку 90 сек"}
          </span>
        </button>

        <span className="text-[9px] text-slate-400 text-center font-medium">
          Автоматическая отправка команды на бортовой терминал ЕГПТС
        </span>
      </div>
    </aside>
  );
};

export default Inspector;
