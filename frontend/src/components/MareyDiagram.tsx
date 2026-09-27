import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Grid2x2,
  ChevronDown,
  Info,
  Radio,
  Clock,
  MapPin,
  TrendingUp,
} from "lucide-react";

interface MareyDiagramProps {
  selectedRouteId?: string;
  onApplyHolding?: (alertId: string) => void;
  onOpenScenarios?: () => void;
  appliedHoldingIds?: string[] | Set<string>;
  isApplied?: boolean;
  isDarkMode?: boolean;
}

interface Station {
  name: string;
  pk: string;
  km: string;
  y: number;
  isMajor?: boolean;
  isWarning?: boolean;
  isCritical?: boolean;
}

interface BusFleetItem {
  id: string;
  model: string;
  pos: string;
  dev: string;
  status: string;
  statusApplied?: string;
  risk: "critical" | "warning" | "normal" | "reserve";
}

interface Trajectory {
  busId: string;
  d: string;
  color: string;
  strokeWidth: number;
  label: string;
  cx: number;
  cy: number;
  isIncident?: boolean;
  isTarget?: boolean;
  projectionNormalD?: string;
  projectionAppliedD?: string;
}

interface RouteConfig {
  id: string;
  alertId: string;
  routeColor: string;
  badgeBg: string;
  name: string;
  subTitle: string;
  totalBuses: number;
  activeBuses: number;
  plannedHeadway: string;
  factHeadway: string;
  factHeadwayApplied: string;
  variationCoeff: string;
  variationCoeffApplied: string;
  incidentType: string;
  incidentRisk: string;
  incidentVehicle: string;
  targetVehicle: string;
  incidentDesc: string;
  incidentDescApplied: string;
  actionTitle: string;
  actionEffect: number;
  actionBtnText: string;
  actionAppliedText: string;
  actionStop: string;
  stations: Station[];
  fleet: BusFleetItem[];
  trajectories: Trajectory[];
}

const ROUTE_CONFIGS: Record<string, RouteConfig> = {
  м3: {
    id: "м3",
    alertId: "alert_1042",
    routeColor: "#10b981",
    badgeBg: "bg-emerald-600",
    name: "Магистраль м3: «Метро Семёновская ⇄ Стадион Лужники»",
    subTitle: "Оперативный график движения Марея • Мониторинг интервалов и пачкования",
    totalBuses: 12,
    activeBuses: 12,
    plannedHeadway: "8.0 мин",
    factHeadway: "1.4 — 14.8 мин",
    factHeadwayApplied: "7.5 — 8.2 мин",
    variationCoeff: "0.42",
    variationCoeffApplied: "0.18",
    incidentType: "ОПАСНОСТЬ ПАЧКОВАНИЯ",
    incidentRisk: "РИСК 94%",
    incidentVehicle: "#1042",
    targetVehicle: "#1043",
    incidentDesc: "Интервал между #1043 и #1042 схлопнулся до 1.4 мин (Норма 8.0 мин). Замедление лидера на Бауманской ведёт к слиянию выпусков.",
    incidentDescApplied: "Holding успешно активирован. Борт #1043 придержан на 2.5 мин. Интервал выровнен до 7.6 мин.",
    actionTitle: "Holding №1043: +2.5м",
    actionEffect: 96,
    actionBtnText: "Применить Holding №1043 (2.5м)",
    actionAppliedText: "Holding №1043 применён",
    actionStop: "«м. Бауманская»",
    stations: [
      { name: "м. Семёновская", pk: "ПК 00+00", km: "0.0 км", y: 30, isMajor: true },
      { name: "м. Электрозаводская", pk: "ПК 18+40", km: "1.8 км", y: 90, isMajor: false },
      { name: "Бакунинская ул.", pk: "ПК 32+10", km: "3.2 км", y: 150, isWarning: true },
      { name: "м. Бауманская", pk: "ПК 46+80", km: "4.7 км", y: 210, isMajor: true, isCritical: true },
      { name: "пл. Разгуляй", pk: "ПК 62+00", km: "6.2 км", y: 270, isMajor: false },
      { name: "ул. Покровка", pk: "ПК 81+50", km: "8.1 км", y: 330, isMajor: false },
      { name: "Лубянская пл.", pk: "ПК 104+20", km: "10.4 км", y: 390, isMajor: false },
      { name: "Театральная пл.", pk: "ПК 121+00", km: "12.1 км", y: 450, isMajor: false },
      { name: "Храм Христа Спасителя", pk: "ПК 148+30", km: "14.8 км", y: 510, isMajor: false },
      { name: "Стадион Лужники", pk: "ПК 184+00", km: "18.4 км", y: 570, isMajor: true },
    ],
    fleet: [
      { id: "№1042", model: "ЛиАЗ-6274", pos: "Бакунинская ул.", dev: "+5.8м", status: "Пачкование (94%)", statusApplied: "Такт 7.8 мин", risk: "critical" },
      { id: "№1043", model: "ЛиАЗ-6274", pos: "м. Бауманская", dev: "-1.2м", status: "Лидер (Задержка)", statusApplied: "Holding 2.5м", risk: "warning" },
      { id: "№1041", model: "КамАЗ-6282", pos: "Театральная пл.", dev: "+0.4м", status: "Норма", risk: "normal" },
      { id: "№1044", model: "ЛиАЗ-6274", pos: "м. Электрозаводская", dev: "+1.1м", status: "Норма", risk: "normal" },
      { id: "№1045", model: "КамАЗ-6282", pos: "м. Семёновская", dev: "+0.2м", status: "Отправление", risk: "normal" },
      { id: "№1039", model: "ЛиАЗ-6274", pos: "Стадион Лужники", dev: "-0.5м", status: "На отстое", risk: "normal" },
      { id: "№1038", model: "КамАЗ-6282", pos: "Храм Христа Спас.", dev: "+0.9м", status: "Норма", risk: "normal" },
      { id: "№1046", model: "ЛиАЗ-6274", pos: "Парк Сокольники", dev: "0.0м", status: "Зарядка 92%", risk: "reserve" },
    ],
    trajectories: [
      {
        busId: "№1040",
        d: "M 0 150 L 80 270 L 170 390 L 240 450 L 320 570",
        color: "#059669",
        strokeWidth: 2.5,
        label: "#1040 (Финиш)",
        cx: 320,
        cy: 570,
      },
      {
        busId: "№1041",
        d: "M 140 30 L 210 150 L 290 270 L 390 390 L 485 450",
        color: "#059669",
        strokeWidth: 2.5,
        label: "#1041 (+0.4м)",
        cx: 485,
        cy: 450,
      },
      {
        busId: "№1043",
        d: "M 290 30 L 350 90 L 420 150 L 500 210",
        color: "#059669",
        strokeWidth: 2.8,
        label: "#1043 (м. Бауманская)",
        cx: 500,
        cy: 210,
        isTarget: true,
        projectionNormalD: "M 500 210 L 550 270 L 610 330 L 680 390 L 740 450",
        projectionAppliedD: "M 530 210 L 590 270 L 660 330 L 730 390 L 800 450 L 880 570",
      },
      {
        busId: "№1042",
        d: "M 370 30 L 420 90 L 460 150 L 488 185",
        color: "#dc2626",
        strokeWidth: 3,
        label: "#1042 (+5.8м ДОГОНЯЕТ)",
        cx: 488,
        cy: 185,
        isIncident: true,
        projectionNormalD: "M 488 185 L 515 210 L 555 270 L 613 330 L 682 390",
        projectionAppliedD: "M 488 185 L 510 210 L 570 270 L 640 330 L 710 390 L 780 450 L 860 570",
      },
    ],
  },
  м7: {
    id: "м7",
    alertId: "alert_2198",
    routeColor: "#3b82f6",
    badgeBg: "bg-blue-600",
    name: "Магистраль м7: «138-й квартал Выхина ⇄ Метро Китай-город»",
    subTitle: "Оперативный график движения Марея • Мониторинг интервалов и заторов",
    totalBuses: 10,
    activeBuses: 10,
    plannedHeadway: "9.0 мин",
    factHeadway: "3.2 — 16.5 мин",
    factHeadwayApplied: "8.5 — 9.2 мин",
    variationCoeff: "0.48",
    variationCoeffApplied: "0.19",
    incidentType: "ЗАТОР ТАГАНСКИЙ УЗЕЛ",
    incidentRisk: "РИСК 94%",
    incidentVehicle: "#2198",
    targetVehicle: "#2199",
    incidentDesc: "Затор на ул. Николоямская, отставание борта #2198 составляет +9.2 мин. Интервал до идущего впереди #2199 растянулся до 14 мин.",
    incidentDescApplied: "Зелёный коридор ЦОДД Т-12 активирован. Задержка ликвидирована, интервал вошёл в нормативный коридор 9.0 мин.",
    actionTitle: "Зелёный коридор: Т-12",
    actionEffect: 89,
    actionBtnText: "Включить зелёный коридор (№2198)",
    actionAppliedText: "Зелёный коридор активен (ЦОДД Т-12)",
    actionStop: "«Таганская площадь»",
    stations: [
      { name: "138-й кв. Выхина", pk: "ПК 00+00", km: "0.0 км", y: 30, isMajor: true },
      { name: "Самаркандский бул.", pk: "ПК 19+20", km: "1.9 км", y: 90, isMajor: false },
      { name: "м. Рязанский проспект", pk: "ПК 38+50", km: "3.8 км", y: 150, isMajor: true },
      { name: "Карачарово", pk: "ПК 64+10", km: "6.4 км", y: 210, isMajor: false },
      { name: "м. Нижегородская", pk: "ПК 85+00", km: "8.5 км", y: 270, isMajor: true },
      { name: "Таганская пл.", pk: "ПК 112+40", km: "11.2 км", y: 330, isMajor: true, isWarning: true },
      { name: "ул. Николоямская", pk: "ПК 128+90", km: "12.9 км", y: 390, isCritical: true },
      { name: "Яузские Ворота", pk: "ПК 142+10", km: "14.2 км", y: 450, isMajor: false },
      { name: "Солянка", pk: "ПК 155+60", km: "15.6 км", y: 510, isMajor: false },
      { name: "м. Китай-город", pk: "ПК 169+00", km: "16.9 км", y: 570, isMajor: true },
    ],
    fleet: [
      { id: "№2198", model: "ЛиАЗ-6274", pos: "ул. Николоямская", dev: "+9.2м", status: "Затор / Отставание", statusApplied: "Зелёный коридор активен", risk: "critical" },
      { id: "№2199", model: "ЛиАЗ-6274", pos: "Таганская пл.", dev: "-0.5м", status: "Интервал 14м", statusApplied: "Такт 8.5 мин", risk: "warning" },
      { id: "№2195", model: "КамАЗ-6282", pos: "м. Нижегородская", dev: "+0.3м", status: "Норма", risk: "normal" },
      { id: "№2194", model: "ЛиАЗ-6274", pos: "Карачарово", dev: "-0.8м", status: "Норма", risk: "normal" },
      { id: "№2193", model: "КамАЗ-6282", pos: "м. Рязанский просп.", dev: "+0.1м", status: "Норма", risk: "normal" },
      { id: "№2192", model: "ЛиАЗ-6274", pos: "138-й кв. Выхина", dev: "0.0м", status: "Отправление", risk: "normal" },
      { id: "№2190", model: "КамАЗ-6282", pos: "м. Китай-город", dev: "-1.0м", status: "Оборот", risk: "normal" },
      { id: "№2197", model: "ЛиАЗ-6274", pos: "Парк Карачарово", dev: "0.0м", status: "Резерв 95%", risk: "reserve" },
    ],
    trajectories: [
      {
        busId: "№2190",
        d: "M 0 210 L 90 330 L 180 450 L 260 570",
        color: "#059669",
        strokeWidth: 2.5,
        label: "#2190 (Финиш)",
        cx: 260,
        cy: 570,
      },
      {
        busId: "№2199",
        d: "M 120 30 L 200 150 L 300 270 L 460 330",
        color: "#059669",
        strokeWidth: 2.8,
        label: "#2199 (Таганская пл.)",
        cx: 460,
        cy: 330,
        isTarget: true,
      },
      {
        busId: "№2198",
        d: "M 220 30 L 310 150 L 410 270 L 470 330 L 495 390",
        color: "#dc2626",
        strokeWidth: 3,
        label: "#2198 (+9.2м ЗАТОР)",
        cx: 495,
        cy: 390,
        isIncident: true,
        projectionNormalD: "M 495 390 L 580 450 L 680 510 L 780 570",
        projectionAppliedD: "M 495 390 L 530 420 L 580 470 L 640 520 L 710 570",
      },
      {
        busId: "№2195",
        d: "M 320 30 L 420 150 L 485 270",
        color: "#059669",
        strokeWidth: 2.5,
        label: "#2195 (м. Нижегородская)",
        cx: 485,
        cy: 270,
      },
    ],
  },
  т88: {
    id: "т88",
    alertId: "alert_0814",
    routeColor: "#8b5cf6",
    badgeBg: "bg-purple-600",
    name: "Магистраль т88: «Новорязанская ул. ⇄ Метро Лубянка»",
    subTitle: "Оперативный график движения Марея • Мониторинг интервалов и сжатия такта",
    totalBuses: 8,
    activeBuses: 8,
    plannedHeadway: "7.0 мин",
    factHeadway: "1.5 — 11.2 мин",
    factHeadwayApplied: "6.8 — 7.3 мин",
    variationCoeff: "0.38",
    variationCoeffApplied: "0.15",
    incidentType: "СЖАТИЕ ИНТЕРВАЛА",
    incidentRisk: "РИСК 92%",
    incidentVehicle: "#0814",
    targetVehicle: "#0815",
    incidentDesc: "Сжатие интервала на 1.5 мин перед м. Красные Ворота. Борт #0814 догоняет #0815 из-за дорожных работ на Садовой-Черногрязской.",
    incidentDescApplied: "Режим Skip-Stop активирован. Борт #0814 проследовал перегруженный узел экспрессом. Такт восстановлен до 7.0 мин.",
    actionTitle: "Режим Skip-Stop (№0814)",
    actionEffect: 92,
    actionBtnText: "Активировать Skip-Stop (№0814)",
    actionAppliedText: "Режим Skip-Stop активирован",
    actionStop: "«Садовая-Черногрязская»",
    stations: [
      { name: "Новорязанская ул.", pk: "ПК 00+00", km: "0.0 км", y: 30, isMajor: true },
      { name: "Комсомольская пл.", pk: "ПК 12+30", km: "1.2 км", y: 120, isMajor: true },
      { name: "Краснопрудная ул.", pk: "ПК 21+40", km: "2.1 км", y: 210, isMajor: false },
      { name: "Садовая-Черногрязская", pk: "ПК 28+60", km: "2.9 км", y: 300, isWarning: true, isCritical: true },
      { name: "м. Красные Ворота", pk: "ПК 39+10", km: "3.9 км", y: 390, isMajor: true },
      { name: "Мясницкая ул.", pk: "ПК 51+40", km: "5.1 км", y: 480, isMajor: false },
      { name: "м. Лубянка", pk: "ПК 62+80", km: "6.3 км", y: 570, isMajor: true },
    ],
    fleet: [
      { id: "№0814", model: "ЛиАЗ-6274", pos: "Садовая-Черногрязская", dev: "+6.1м", status: "Сжатие такта (92%)", statusApplied: "Skip-Stop активен", risk: "critical" },
      { id: "№0815", model: "ЛиАЗ-6274", pos: "м. Красные Ворота", dev: "-0.4м", status: "Лидер", statusApplied: "Такт выровнен", risk: "warning" },
      { id: "№0812", model: "КамАЗ-6282", pos: "Комсомольская пл.", dev: "+0.2м", status: "Норма", risk: "normal" },
      { id: "№0811", model: "ЛиАЗ-6274", pos: "Новорязанская ул.", dev: "0.0м", status: "Отправление", risk: "normal" },
      { id: "№0810", model: "КамАЗ-6282", pos: "м. Лубянка", dev: "-0.5м", status: "Оборот", risk: "normal" },
      { id: "№0816", model: "ЛиАЗ-6274", pos: "Парк Басманный", dev: "0.0м", status: "Резерв 98%", risk: "reserve" },
    ],
    trajectories: [
      {
        busId: "№0810",
        d: "M 0 210 L 110 390 L 220 570",
        color: "#059669",
        strokeWidth: 2.5,
        label: "#0810 (Финиш)",
        cx: 220,
        cy: 570,
      },
      {
        busId: "№0815",
        d: "M 160 30 L 280 210 L 400 390 L 490 480",
        color: "#059669",
        strokeWidth: 2.8,
        label: "#0815 (м. Красные Ворота)",
        cx: 490,
        cy: 480,
        isTarget: true,
      },
      {
        busId: "№0814",
        d: "M 260 30 L 370 210 L 475 300",
        color: "#dc2626",
        strokeWidth: 3,
        label: "#0814 (+6.1м СЖАТИЕ)",
        cx: 475,
        cy: 300,
        isIncident: true,
        projectionNormalD: "M 475 300 L 510 390 L 540 480 L 570 570",
        projectionAppliedD: "M 475 300 L 530 390 L 590 480 L 660 570",
      },
      {
        busId: "№0812",
        d: "M 380 30 L 480 120",
        color: "#059669",
        strokeWidth: 2.5,
        label: "#0812 (Комсомольская пл.)",
        cx: 480,
        cy: 120,
      },
    ],
  },
};

export const MareyDiagram: React.FC<MareyDiagramProps> = ({
  selectedRouteId = "м3",
  onApplyHolding,
  onOpenScenarios,
  appliedHoldingIds,
  isApplied = false,
  isDarkMode = false,
}) => {
  const [activeRouteId, setActiveRouteId] = useState<string>(() => {
    if (selectedRouteId && ROUTE_CONFIGS[selectedRouteId]) return selectedRouteId;
    return "м3";
  });
  const [filterMode, setFilterMode] = useState<"all" | "anomalies">("all");
  const [showPlan, setShowPlan] = useState<boolean>(true);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  const routeConfig = useMemo(() => {
    return ROUTE_CONFIGS[activeRouteId] || ROUTE_CONFIGS["м3"];
  }, [activeRouteId]);

  const isRouteApplied = useMemo(() => {
    if (appliedHoldingIds) {
      if (Array.isArray(appliedHoldingIds)) {
        if (appliedHoldingIds.includes(routeConfig.alertId)) return true;
      } else if (typeof (appliedHoldingIds as any).has === "function") {
        if ((appliedHoldingIds as any).has(routeConfig.alertId)) return true;
      }
    }
    if (activeRouteId === "м3" && isApplied) return true;
    return false;
  }, [appliedHoldingIds, routeConfig.alertId, activeRouteId, isApplied]);

  const handleApply = () => {
    if (onApplyHolding) {
      onApplyHolding(routeConfig.alertId);
    }
  };

  const filteredFleet = useMemo(() => {
    return routeConfig.fleet.filter((b) => {
      if (filterMode === "anomalies") {
        return b.risk === "critical" || b.risk === "warning";
      }
      return true;
    });
  }, [routeConfig.fleet, filterMode]);

  return (
    <div
      className={`w-full h-full flex flex-col font-sans select-none overflow-hidden transition-colors ${
        isDarkMode ? "bg-[#121214] text-zinc-200" : "bg-[#f4f4f5] text-zinc-800"
      }`}
    >
      {/* 1. Sub-Header: Route Switcher + KPI Bar */}
      <div
        className={`h-12 px-4 border-b flex items-center justify-between shrink-0 transition-colors ${
          isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Interactive Route Switcher Buttons */}
          <div className="flex items-center gap-1.5 p-0.5 rounded-lg border bg-zinc-100 dark:bg-[#141416] border-zinc-200 dark:border-white/10">
            {Object.keys(ROUTE_CONFIGS).map((rid) => {
              const cfg = ROUTE_CONFIGS[rid];
              const isActive = activeRouteId === rid;
              return (
                <button
                  key={rid}
                  onClick={() => {
                    setActiveRouteId(rid);
                    setSelectedBusId(null);
                    setSelectedStation(null);
                  }}
                  className={`h-7 px-2.5 rounded-md text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? isDarkMode
                        ? "bg-zinc-700 text-white shadow-xs ring-1 ring-white/20"
                        : "bg-white text-zinc-900 shadow-xs ring-1 ring-zinc-300"
                      : isDarkMode
                      ? "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-white/60"
                  }`}
                  title={`Переключить на маршрут ${rid}`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.routeColor }}
                  />
                  <span>{rid}</span>
                </button>
              );
            })}
          </div>

          <div className="h-5 w-px bg-zinc-200 dark:bg-white/10" />

          {/* Current Route Title */}
          <div className="flex flex-col">
            <span
              className={`text-xs font-bold tracking-tight uppercase ${
                isDarkMode ? "text-white" : "text-zinc-900"
              }`}
            >
              {routeConfig.name}
            </span>
            <span className="text-[10px] font-medium text-zinc-400 font-mono">
              {routeConfig.subTitle}
            </span>
          </div>
        </div>

        {/* Route Realtime KPIs */}
        <div className="flex items-center gap-2">
          <div
            className={`px-2.5 py-1 rounded-md border flex items-center gap-2 ${
              isDarkMode ? "bg-[#222226] border-white/10" : "bg-zinc-50 border-zinc-200"
            }`}
          >
            <span className="text-[10px] text-zinc-400 font-medium">Бортов:</span>
            <span
              className={`text-xs font-bold font-mono ${
                isDarkMode ? "text-white" : "text-zinc-900"
              }`}
            >
              {routeConfig.activeBuses}/{routeConfig.totalBuses}
            </span>
          </div>

          <div
            className={`px-2.5 py-1 rounded-md border flex items-center gap-2 ${
              isDarkMode ? "bg-[#222226] border-white/10" : "bg-zinc-50 border-zinc-200"
            }`}
          >
            <span className="text-[10px] text-zinc-400 font-medium">Плановый такт:</span>
            <span
              className={`text-xs font-bold font-mono ${
                isDarkMode ? "text-zinc-100" : "text-zinc-900"
              }`}
            >
              {routeConfig.plannedHeadway}
            </span>
          </div>

          <div
            className={`px-2.5 py-1 rounded-md border flex items-center gap-2 ${
              isDarkMode ? "bg-[#222226] border-white/10" : "bg-zinc-50 border-zinc-200"
            }`}
          >
            <span className="text-[10px] text-zinc-400 font-medium">Факт интервал:</span>
            <span
              className={`text-xs font-bold font-mono ${
                isRouteApplied
                  ? isDarkMode
                    ? "text-zinc-100"
                    : "text-zinc-900"
                  : "text-amber-400 font-semibold"
              }`}
            >
              {isRouteApplied ? routeConfig.factHeadwayApplied : routeConfig.factHeadway}
            </span>
          </div>

          <div
            className={`px-2.5 py-1 rounded-md border flex items-center gap-2 ${
              isDarkMode ? "bg-[#222226] border-white/10" : "bg-zinc-50 border-zinc-200"
            }`}
          >
            <span className="text-[10px] text-zinc-400 font-medium">Коэфф. вариации CV:</span>
            <span
              className={`text-xs font-bold font-mono ${
                isRouteApplied ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {isRouteApplied ? routeConfig.variationCoeffApplied : routeConfig.variationCoeff}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Workspace: Space-Time Diagram + Fleet Sidebar */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Space-Time Diagram Workspace */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Controls Bar */}
          <div
            className={`h-9 px-4 border-b flex items-center justify-between shrink-0 text-xs ${
              isDarkMode ? "bg-[#141416] border-white/10" : "bg-zinc-50 border-zinc-200"
            }`}
          >
            <div className="flex items-center gap-4 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-500 inline-block" /> Факт
              </span>
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-3 h-0.5 border-t border-dashed border-zinc-400 inline-block" /> План
              </span>
              <span className="flex items-center gap-1.5 text-rose-500">
                <span className="w-3 h-0.5 bg-rose-500 inline-block" /> Аномалия / Задержка
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-emerald-400 inline-block" /> СППР Регулирование
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedBusId && (
                <button
                  onClick={() => setSelectedBusId(null)}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors cursor-pointer"
                >
                  Сбросить выбор ({selectedBusId})
                </button>
              )}
              <button
                onClick={() => setShowPlan(!showPlan)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  showPlan
                    ? isDarkMode
                      ? "bg-zinc-800 border-white/20 text-white"
                      : "bg-white border-zinc-300 text-zinc-800"
                    : "text-zinc-400 border-transparent"
                }`}
              >
                Сетка плана
              </button>
            </div>
          </div>

          {/* Time-Space SVG Graph Surface */}
          <div className="flex-1 min-h-0 overflow-auto relative">
            <div className="min-w-[900px] h-[640px] relative p-4 flex">
              {/* Station Axis Labels on Left */}
              <div className="w-[180px] shrink-0 flex flex-col justify-between py-4 pr-3 border-r border-zinc-200 dark:border-white/10 text-right">
                {routeConfig.stations.map((st) => {
                  const isSelected = selectedStation === st.name;
                  return (
                    <div
                      key={st.name}
                      onClick={() => setSelectedStation(isSelected ? null : st.name)}
                      className={`flex flex-col items-end cursor-pointer p-1 rounded transition-colors ${
                        isSelected
                          ? "bg-zinc-800/80 ring-1 ring-white/20"
                          : "hover:bg-zinc-500/10"
                      }`}
                      title="Кликните для фильтрации по остановке"
                    >
                      <span
                        className={`text-[11px] font-semibold truncate ${
                          st.isCritical
                            ? "text-rose-500 font-bold"
                            : st.isWarning
                            ? "text-amber-500 font-bold"
                            : st.isMajor
                            ? isDarkMode
                              ? "text-white font-bold"
                              : "text-zinc-900 font-bold"
                            : isDarkMode
                            ? "text-zinc-400"
                            : "text-zinc-600"
                        }`}
                      >
                        {st.name}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400">
                        {st.pk} • {st.km}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Time-Space Grid & Curves */}
              <div className="flex-1 relative ml-3">
                {/* Horizontal Station Lines */}
                {routeConfig.stations.map((st) => (
                  <div
                    key={st.name}
                    className={`absolute left-0 right-0 border-b ${
                      st.isMajor
                        ? isDarkMode
                          ? "border-white/15"
                          : "border-zinc-300"
                        : isDarkMode
                        ? "border-white/5"
                        : "border-zinc-100"
                    }`}
                    style={{ top: `${(st.y / 600) * 100}%` }}
                  />
                ))}

                {/* Vertical Time Grid Columns */}
                {["14:00", "14:15", "14:30", "14:45", "15:00", "15:15", "15:30"].map(
                  (t, idx) => (
                    <div
                      key={t}
                      className={`absolute top-0 bottom-0 border-r ${
                        isDarkMode ? "border-white/10" : "border-zinc-200"
                      }`}
                      style={{ left: `${(idx / 6) * 100}%` }}
                    >
                      <span
                        className={`absolute top-0 -translate-x-1/2 text-[10px] font-mono font-medium ${
                          isDarkMode ? "text-zinc-400" : "text-zinc-500"
                        }`}
                      >
                        {t}
                      </span>
                    </div>
                  )
                )}

                {/* Trajectory SVG Curves */}
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 900 600"
                  preserveAspectRatio="none"
                >
                  {/* Plan Lines */}
                  {showPlan && (
                    <g
                      stroke={
                        isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"
                      }
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    >
                      <line x1="50" y1="30" x2="350" y2="570" />
                      <line x1="200" y1="30" x2="500" y2="570" />
                      <line x1="350" y1="30" x2="650" y2="570" />
                      <line x1="500" y1="30" x2="800" y2="570" />
                    </g>
                  )}

                  {/* Dynamic Trajectories */}
                  {routeConfig.trajectories.map((traj) => {
                    const isSelected = selectedBusId === traj.busId;
                    const strokeColor = isSelected ? "#38bdf8" : traj.color;
                    const strokeW = isSelected ? traj.strokeWidth + 2 : traj.strokeWidth;

                    return (
                      <g
                        key={traj.busId}
                        onClick={() => setSelectedBusId(isSelected ? null : traj.busId)}
                        className="cursor-pointer transition-opacity"
                        style={{
                          opacity:
                            selectedBusId && !isSelected ? 0.35 : 1,
                        }}
                      >
                        {/* Trajectory Line */}
                        <path
                          d={traj.d}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeW}
                          strokeLinecap="round"
                          className="hover:stroke-cyan-400 transition-colors"
                        />

                        {/* Node Circle */}
                        <circle
                          cx={traj.cx}
                          cy={traj.cy}
                          r={isSelected ? 6.5 : traj.isIncident ? 5 : 4}
                          fill={strokeColor}
                          stroke="#fff"
                          strokeWidth="1.5"
                          className="hover:r-7 transition-all"
                        />

                        {/* Node Label */}
                        <text
                          x={traj.cx + 10}
                          y={traj.cy - 5}
                          fill={
                            isSelected
                              ? "#38bdf8"
                              : traj.isIncident
                              ? "#f87171"
                              : isDarkMode
                              ? "#cbd5e1"
                              : "#065f46"
                          }
                          fontFamily="monospace"
                          fontSize="10"
                          fontWeight={isSelected || traj.isIncident ? "bold" : "normal"}
                        >
                          {traj.label}
                        </text>

                        {/* Future Projection Lines */}
                        {traj.isIncident && !isRouteApplied && traj.projectionNormalD && (
                          <path
                            d={traj.projectionNormalD}
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth="1.8"
                            strokeDasharray="3 3"
                            opacity="0.5"
                          />
                        )}
                        {traj.isIncident && isRouteApplied && traj.projectionAppliedD && (
                          <path
                            d={traj.projectionAppliedD}
                            fill="none"
                            stroke="#059669"
                            strokeWidth="2.5"
                            strokeDasharray="4 3"
                          />
                        )}

                        {traj.isTarget && isRouteApplied && (
                          <>
                            {activeRouteId === "м3" && (
                              <line
                                x1={traj.cx}
                                y1={traj.cy}
                                x2={traj.cx + 30}
                                y2={traj.cy}
                                stroke="#059669"
                                strokeWidth="4"
                                strokeLinecap="round"
                              />
                            )}
                            {traj.projectionAppliedD && (
                              <path
                                d={traj.projectionAppliedD}
                                fill="none"
                                stroke="#059669"
                                strokeWidth="2.5"
                                strokeDasharray="4 3"
                              />
                            )}
                          </>
                        )}
                      </g>
                    );
                  })}

                  {/* Now Reference Vertical Line */}
                  <line
                    x1="500"
                    y1="0"
                    x2="500"
                    y2="600"
                    stroke="#dc2626"
                    strokeWidth="1.5"
                  />
                  <g transform="translate(460, 2)">
                    <rect width="80" height="18" rx="4" fill="#dc2626" />
                    <text
                      x="40"
                      y="12"
                      fill="#fff"
                      fontFamily="monospace"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      СЕЙЧАС 14:45
                    </text>
                  </g>
                </svg>

                {/* Floating Warning Popover Card */}
                {!isRouteApplied ? (
                  <div
                    className={`absolute left-[340px] top-[120px] rounded-xl p-3.5 shadow-lg w-[320px] pointer-events-auto z-30 border backdrop-blur-md ${
                      isDarkMode
                        ? "bg-[#1c1c20]/95 border-rose-500/40 text-zinc-100 shadow-black/60"
                        : "bg-white/95 border-rose-300 text-zinc-800 shadow-zinc-900/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 border-b border-rose-500/20 pb-2 mb-2">
                      <div className="flex items-center gap-1.5 text-rose-500 font-bold text-xs">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{routeConfig.incidentType}</span>
                      </div>
                      <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded text-[9px] font-bold border border-rose-500/30">
                        {routeConfig.incidentRisk}
                      </span>
                    </div>

                    <p
                      className={`text-xs leading-relaxed ${
                        isDarkMode ? "text-zinc-300" : "text-zinc-600"
                      }`}
                    >
                      {routeConfig.incidentDesc}
                    </p>

                    <div
                      className={`mt-2.5 p-2 rounded-lg border flex items-center justify-between ${
                        isDarkMode
                          ? "bg-emerald-950/30 border-emerald-800/60"
                          : "bg-emerald-50 border-emerald-200"
                      }`}
                    >
                      <div
                        className={`text-xs font-bold ${
                          isDarkMode ? "text-emerald-300" : "text-emerald-900"
                        }`}
                      >
                        {routeConfig.actionTitle}
                      </div>
                      <button
                        onClick={handleApply}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        Применить
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="absolute left-[440px] top-[210px] bg-emerald-700 text-white text-[11px] font-mono font-semibold px-3 py-1.5 rounded-lg shadow-md z-20 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {routeConfig.actionAppliedText} ({routeConfig.actionStop})
                    </span>
                    <button
                      onClick={handleApply}
                      className="ml-1 text-[10px] font-sans font-bold bg-emerald-900/80 hover:bg-emerald-950 text-emerald-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors border border-emerald-500/30"
                      title="Сбросить статус меры"
                    >
                      Сброс
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Footer Info */}
          <div
            className={`h-8 px-4 border-t flex items-center justify-between shrink-0 text-[10px] font-mono ${
              isDarkMode
                ? "bg-[#141416] border-white/10 text-zinc-400"
                : "bg-white border-zinc-200 text-zinc-500"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`font-semibold ${
                  isDarkMode ? "text-zinc-300" : "text-zinc-700"
                }`}
              >
                Телеметрический срез: 14:45:00
              </span>
              <span>•</span>
              <span>Модель движения: АСУ «Навигатор-ГПТ»</span>
            </div>
            <div>
              <span>Расчётный такт восстановления: </span>
              <span className="text-emerald-500 font-bold">
                {isRouteApplied ? "14:52 (норма достигнута)" : "15:02 (через 17 мин)"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Fleet Monitoring Sidebar */}
        <aside
          className={`w-[280px] border-l flex flex-col shrink-0 transition-colors ${
            isDarkMode
              ? "bg-[#18181b] border-white/10 text-zinc-200"
              : "bg-white border-zinc-200 text-zinc-800"
          }`}
        >
          {/* Sidebar Header */}
          <div
            className={`p-3 border-b shrink-0 ${
              isDarkMode ? "bg-[#141416] border-white/10" : "bg-zinc-50 border-zinc-200"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span
                className={`text-xs font-bold ${
                  isDarkMode ? "text-white" : "text-zinc-900"
                }`}
              >
                Мониторинг бортов {activeRouteId} ({routeConfig.fleet.length} ед.)
              </span>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                  isDarkMode
                    ? "bg-white/10 text-zinc-300 border-white/10"
                    : "bg-zinc-100 text-zinc-600 border-zinc-200"
                }`}
              >
                LIVE
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono mb-2">
              ЛиАЗ-6274 • КамАЗ-6282
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFilterMode("all")}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  filterMode === "all"
                    ? isDarkMode
                      ? "bg-zinc-700 text-white"
                      : "bg-zinc-800 text-white"
                    : isDarkMode
                    ? "bg-[#222226] text-zinc-400"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                Все борта ({routeConfig.fleet.length})
              </button>
              <button
                onClick={() => setFilterMode("anomalies")}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  filterMode === "anomalies"
                    ? "bg-rose-600 text-white"
                    : isDarkMode
                    ? "bg-[#222226] text-zinc-400"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                Аномалии (2)
              </button>
            </div>
          </div>

          {/* Fleet List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-white/5">
            {filteredFleet.map((b) => {
              const isSelected = selectedBusId === b.id;
              const isCrit = b.risk === "critical";
              const isWarn = b.risk === "warning";

              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBusId(isSelected ? null : b.id)}
                  className={`p-2.5 flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? isDarkMode
                        ? "bg-zinc-800 border-l-4 border-cyan-400"
                        : "bg-zinc-100 border-l-4 border-cyan-500"
                      : isCrit
                      ? "bg-rose-500/10 border-l-2 border-rose-500 hover:bg-rose-500/15"
                      : isWarn
                      ? "bg-amber-500/10 border-l-2 border-amber-500 hover:bg-amber-500/15"
                      : isDarkMode
                      ? "hover:bg-white/5"
                      : "hover:bg-zinc-50"
                  }`}
                  title="Кликните, чтобы выделить траекторию на графике"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono text-xs font-bold ${
                          isSelected
                            ? "text-cyan-400"
                            : isDarkMode
                            ? "text-white"
                            : "text-zinc-900"
                        }`}
                      >
                        {b.id}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1 py-0.2 rounded border ${
                          isDarkMode
                            ? "text-zinc-400 bg-zinc-800/80 border-white/5"
                            : "text-zinc-500 bg-zinc-100 border-zinc-200"
                        }`}
                      >
                        {b.model}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-0.5">{b.pos}</span>
                  </div>

                  <div className="flex flex-col items-end text-right">
                    <span
                      className={`font-mono text-xs font-bold ${
                        isCrit
                          ? "text-rose-400"
                          : isWarn
                          ? "text-amber-400"
                          : isDarkMode
                          ? "text-zinc-300"
                          : "text-zinc-700"
                      }`}
                    >
                      {b.dev}
                    </span>
                    <span
                      className={`text-[9px] font-bold mt-0.5 ${
                        isCrit
                          ? "text-rose-400"
                          : isWarn
                          ? "text-amber-400"
                          : isDarkMode
                          ? "text-zinc-400"
                          : "text-zinc-600"
                      }`}
                    >
                      {isRouteApplied && b.statusApplied ? b.statusApplied : b.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom DSS Box */}
          <div
            className={`p-3 border-t flex flex-col gap-2 shrink-0 ${
              isDarkMode ? "bg-[#141416] border-white/10" : "bg-zinc-50 border-zinc-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isDarkMode ? "text-zinc-300" : "text-zinc-700"
                }`}
              >
                СППР Регулирование
              </span>
              <span
                className={`px-1.5 py-0.2 text-[9px] font-bold rounded border ${
                  isDarkMode
                    ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}
              >
                {routeConfig.actionEffect}% УСПЕХ
              </span>
            </div>

            <p
              className={`text-[10.5px] leading-relaxed ${
                isDarkMode ? "text-zinc-400" : "text-zinc-600"
              }`}
            >
              {isRouteApplied
                ? routeConfig.incidentDescApplied
                : `Директива СППР: ${routeConfig.actionTitle} на узле ${routeConfig.actionStop}.`}
            </p>

            <button
              onClick={handleApply}
              className={`w-full h-8 px-2.5 rounded-lg text-white font-bold text-[11px] shadow-xs transition-all flex items-center justify-center gap-1.5 uppercase cursor-pointer ${
                isRouteApplied
                  ? "bg-zinc-700 hover:bg-zinc-600 text-zinc-100 border border-zinc-500/40 active:scale-95"
                  : "bg-emerald-600 hover:bg-emerald-500 active:scale-95 shadow-emerald-900/20"
              }`}
              title={
                isRouteApplied
                  ? "Меры активированы. Нажмите, чтобы отменить и сбросить"
                  : "Применить директиву СППР"
              }
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${isRouteApplied ? "text-emerald-400" : ""}`} />
              <span>
                {isRouteApplied
                  ? `${routeConfig.actionAppliedText} (Сбросить)`
                  : routeConfig.actionBtnText}
              </span>
            </button>

            {onOpenScenarios && (
              <button
                onClick={onOpenScenarios}
                className={`w-full h-7 px-2 rounded-md border text-[10px] font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  isDarkMode
                    ? "border-white/10 bg-[#222226] hover:bg-zinc-700 text-zinc-300"
                    : "border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700"
                }`}
              >
                <Grid2x2 size={11} className="shrink-0" />
                <span>Матрица сценариев (4)</span>
                <ChevronDown size={11} className="shrink-0" />
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MareyDiagram;
