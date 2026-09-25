import React from "react";
import {
  Bus,
  Clock,
  TrendingUp,
  Cpu,
  CheckCircle2,
  AlertOctagon,
  Users,
  Gauge,
  UserCheck,
  ShieldCheck,
  ArrowRight,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
  if (!vehicle) {
    return (
      <aside className="w-[380px] xl:w-[420px] h-full flex flex-col bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-lg p-6 items-center justify-center text-slate-400">
        <Bus size={40} className="mb-2 opacity-50" />
        <p className="text-sm font-semibold">Выберите борт на карте или из списка</p>
      </aside>
    );
  }

  const recommendation = alert?.recommendation;
  const isApplied = recommendation?.applied || false;
  const chartData = alert?.delayChartData || [];
  const shapFactors = alert?.shapFactors || [];

  return (
    <aside className="w-[380px] xl:w-[420px] h-full flex flex-col bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-lg overflow-hidden shrink-0 z-20 pointer-events-auto">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
            <Bus size={15} />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Инспектор борта и Рекомендации
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">
              Аналитика рейса и предиктивный синтез
            </p>
          </div>
        </div>

        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
          {vehicle.routeId} • РЕЙС 101
        </span>
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* 1. Selected Vehicle Card */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900">
                  Борт {vehicle.id}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  — {vehicle.model}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                Рейс {vehicle.routeId}: {vehicle.routeName}
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-bold shadow-2xs">
              {vehicle.plateNumber}
            </span>
          </div>

          {/* Status banner */}
          <div
            className={`mt-2.5 p-2 rounded-lg text-xs font-bold flex items-center justify-between ${
              isApplied
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : vehicle.status === "BUNCHING_RISK"
                ? "bg-rose-50 text-rose-800 border border-rose-200"
                : "bg-amber-50 text-amber-800 border border-amber-200"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {isApplied ? (
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertOctagon size={14} className="text-rose-600 shrink-0" />
              )}
              <span>
                {isApplied
                  ? "Опоздание 2.5 мин → Прогноз на конечную: +2.5 мин (Штатно)"
                  : "Опоздание 3 мин → Прогноз на конечную: +16 мин"}
              </span>
            </div>
          </div>

          {/* Micro telemetry telemetry grid */}
          <div className="grid grid-cols-3 gap-2 mt-2.5">
            <div className="p-2 rounded-lg bg-white border border-slate-200/70">
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <Clock size={11} />
                <span>Интервал</span>
              </div>
              <div
                className={`text-xs font-black mt-0.5 ${
                  isApplied
                    ? "text-emerald-600"
                    : vehicle.headwaySeconds < 180
                    ? "text-rose-600"
                    : "text-slate-800"
                }`}
              >
                {isApplied ? "7.5 мин" : `${(vehicle.headwaySeconds / 60).toFixed(1)} мин`}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-white border border-slate-200/70">
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <Gauge size={11} />
                <span>Скорость</span>
              </div>
              <div className="text-xs font-black text-slate-800 mt-0.5">
                {vehicle.speedKmh} км/ч
              </div>
            </div>

            <div className="p-2 rounded-lg bg-white border border-slate-200/70">
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <Users size={11} />
                <span>Загрузка</span>
              </div>
              <div className="text-xs font-black text-slate-800 mt-0.5">
                {vehicle.occupancyPercent}%
              </div>
            </div>
          </div>
        </div>

        {/* 2. Recharts LineChart: «План vs Прогноз задержки» */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={14} className="text-blue-600" />
              <h3 className="text-xs font-bold text-slate-900">
                План vs Прогноз задержки
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              По точкам остановок (мин)
            </span>
          </div>

          <div className="w-full h-44 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="stop"
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  unit=" м"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderColor: "#e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                  formatter={(value: any, name: any) => [
                    `${value} мин`,
                    name === "plan"
                      ? "План"
                      : name === "withoutAction"
                      ? "Без мер"
                      : "С рекомендацией ИИ",
                  ]}
                />
                <Legend
                  verticalAlign="top"
                  height={24}
                  iconSize={8}
                  wrapperStyle={{ fontSize: "10px", paddingBottom: "4px" }}
                />

                {/* Plan: dashed blue line */}
                <Line
                  type="monotone"
                  dataKey="plan"
                  name="План"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />

                {/* Without DSS: steep red curve */}
                <Line
                  type="monotone"
                  dataKey="withoutAction"
                  name="Без мер"
                  stroke="#ef4444"
                  strokeWidth={isApplied ? 1.5 : 2.5}
                  strokeOpacity={isApplied ? 0.35 : 1}
                  dot={{ r: 3, fill: "#ef4444" }}
                />

                {/* With AI Recommendation: emerald stabilization */}
                <Line
                  type="monotone"
                  dataKey="withHolding"
                  name="С рекомендацией ИИ"
                  stroke="#10b981"
                  strokeWidth={isApplied ? 2.5 : 2}
                  strokeDasharray={isApplied ? "" : "3 3"}
                  dot={{ r: 3, fill: "#10b981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Explainable AI: SHAP Factor Analysis */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Cpu size={14} className="text-amber-500" />
              <h3 className="text-xs font-bold text-slate-900">
                Факторный анализ задержки (SHAP)
              </h3>
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              XAI
            </span>
          </div>

          <div className="space-y-2.5">
            {shapFactors.map((factor, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-700">{factor.title}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800">
                      +{factor.delayMinutes.toFixed(1)} мин
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      ({factor.percent}%)
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
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

        {/* 4. Prescriptive Analytics: Algorithm Recommendation */}
        {recommendation && (
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isApplied
                ? "bg-emerald-50/80 border-emerald-300 shadow-sm"
                : "bg-gradient-to-br from-white to-blue-50/40 border-blue-200 shadow-md ring-1 ring-blue-500/10"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={15} className={isApplied ? "text-emerald-600" : "text-blue-600"} />
                <h3 className="text-xs font-bold text-slate-900">
                  Рекомендация алгоритма (Holding)
                </h3>
              </div>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  isApplied
                    ? "bg-emerald-200/70 text-emerald-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                Эффект: {recommendation.effectPercent}%
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {recommendation.text}
            </p>

            {/* Action CTA Button */}
            <button
              onClick={() => !isApplied && onApplyHolding(alert?.id || "")}
              disabled={isApplied}
              className={`w-full mt-3 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
                isApplied
                  ? "bg-emerald-600 text-white cursor-default shadow-emerald-500/20"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/40 active:scale-[0.99] cursor-pointer"
              }`}
            >
              {isApplied ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>✓ Применено и передано в АСУ-РДС</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>✓ Применить и передать в АСУ</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
