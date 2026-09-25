import React from "react";
import {
  TrendingUp,
  Cpu,
  CheckCircle2,
  X,
  Info,
  Bot,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Vehicle, AlertItem } from "../mock/telemetry";

interface InspectorProps {
  vehicle: Vehicle | null;
  alert: AlertItem | null;
  onApplyHolding: (alertId: string) => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  vehicle,
  alert,
  onApplyHolding,
}) => {
  if (!vehicle || !alert) return null;

  const recommendation = alert.recommendation;
  const isApplied = recommendation.applied;
  const chartData = alert.delayChartData;
  const shapFactors = alert.shapFactors;

  return (
    <aside className="w-[370px] xl:w-[390px] h-full flex flex-col bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-lg overflow-hidden shrink-0 z-20 pointer-events-auto">
      {/* 1. Header: Борт P1042, ЛиАЗ-6274 (Электробус), Close Button */}
      <div className="p-3.5 border-b border-slate-100 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-blue-600 tracking-tight">
              Борт {vehicle.id}
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
              {vehicle.model}
            </span>
          </div>

          <p className="text-xs font-bold text-slate-800 mt-1">
            Рейс: {vehicle.routeId} ({vehicle.routeName})
          </p>

          <p className="text-xs font-bold text-rose-700 mt-0.5">
            {isApplied
              ? "Опоздание 2.5 мин → Прогноз на задержки: +2.5 мин (Штатно)"
              : "Опоздание 3 мин → Прогноз на задержки: +16 мин"}
          </p>
        </div>

        <button className="text-slate-400 hover:text-slate-600 p-1">
          <X size={16} />
        </button>
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 scrollbar-thin">
        {/* Section 1: ПЛАН VS ПРОГНОЗ ЗАДЕРЖКИ */}
        <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase">
              <TrendingUp size={14} className="text-blue-600" />
              <span>ПЛАН VS ПРОГНОЗ ЗАДЕРЖКИ</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
              По остановкам
            </span>
          </div>

          {/* Recharts LineChart matching screenshot */}
          <div className="w-full h-36 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="stop"
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={false}
                />
                <YAxis
                  ticks={[0, 50, 100, 150]}
                  domain={[0, 160]}
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderColor: "#e2e8f0",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                  formatter={(val: any, name: any) => [
                    `${val} с`,
                    name === "plan"
                      ? "План"
                      : name === "withoutAction"
                      ? "Прогноз без мер"
                      : "С рекомендацией ИИ",
                  ]}
                />

                {/* Plan: Gray / subtle blue */}
                <Line
                  type="monotone"
                  dataKey="plan"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={false}
                />

                {/* Without DSS: steep red curve */}
                <Line
                  type="monotone"
                  dataKey="withoutAction"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#ef4444" }}
                />

                {/* With AI Holding: flat green/teal line */}
                <Line
                  type="monotone"
                  dataKey="withHolding"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Custom Legend matching screenshot */}
          <div className="flex items-center justify-between text-[10px] text-slate-600 mt-2 px-1 border-t border-slate-200/60 pt-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>План (график)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-rose-500"></span>
              <span className="font-bold text-rose-700">Прогноз (без мер)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-bold text-emerald-700">С рекомендацией ИИ</span>
            </div>
          </div>
        </div>

        {/* Section 2: ФАКТОРНЫЙ АНАЛИЗ ЗАДЕРЖКИ (SHAP) */}
        <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase">
              <Cpu size={14} className="text-blue-600" />
              <span>ФАКТОРНЫЙ АНАЛИЗ ЗАДЕРЖКИ (SHAP)</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200/70">
              +12.0 мин
            </span>
          </div>

          <div className="space-y-2">
            {shapFactors.map((factor, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-700 truncate max-w-[210px]">
                    {factor.title}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-900">
                      {factor.delayMinutes > 0 ? `+${factor.delayMinutes.toFixed(1)}` : factor.delayMinutes.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      ({factor.percent}%)
                    </span>
                  </div>
                </div>

                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${factor.percent}%`,
                      backgroundColor: factor.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Рекомендация алгоритма matching screenshot */}
        <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-blue-900">
              <Bot size={15} className="text-blue-600" />
              <span>Рекомендация алгоритма</span>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              ЭФФЕКТ: {recommendation.effectPercent}%
            </span>
          </div>

          {/* Operational Action Sub-label */}
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
            ОПЕРАТИВНОЕ ДЕЙСТВИЕ:
          </div>

          {/* Main Action Instruction */}
          <p className="text-xs font-black text-slate-900 leading-snug">
            {recommendation.text}
          </p>

          {/* Info callout matching screenshot */}
          <div className="mt-2 p-2 rounded-lg bg-white/80 border border-sky-100 flex items-start gap-1.5 text-[11px] text-slate-600 leading-snug">
            <Info size={14} className="text-sky-600 shrink-0 mt-0.5" />
            <span>{recommendation.infoText}</span>
          </div>

          {/* Full-width Big Green CTA Button */}
          <button
            onClick={() => !isApplied && onApplyHolding(alert.id)}
            disabled={isApplied}
            className={`w-full mt-3 py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md ${
              isApplied
                ? "bg-emerald-600 text-white cursor-default shadow-emerald-500/20"
                : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30 hover:shadow-lg cursor-pointer active:scale-[0.99]"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>{isApplied ? "✓ Применено и передано в АСУ" : "✓ Применить и передать в АСУ"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
