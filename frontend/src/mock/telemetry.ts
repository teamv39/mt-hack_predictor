export interface ShapFactor {
  title: string;
  delayMinutes: number;
  percent: number;
  color: string;
}

export interface DelayChartPoint {
  stop: string;
  plan: number;
  withoutAction: number;
  withHolding: number;
}

export interface Recommendation {
  id: string;
  targetVehicleId: string;
  durationSeconds: number;
  durationMinutes: number;
  stopName: string;
  effectPercent: number;
  text: string;
  infoText: string;
  applied: boolean;
}

export interface Vehicle {
  id: string;
  badgeLabel: string;
  plateNumber: string;
  model: string;
  routeId: string;
  routeName: string;
  status: 'BUNCHING_RISK' | 'NORMAL' | 'DELAYED';
  delaySeconds: number;
  predictedTerminalDelayMinutes: number;
  speedKmh: number;
  latitude: number;
  longitude: number;
  heading: number;
  currentStop: string;
  nextStop: string;
}

export interface AlertMetrics {
  headway_collapse_sec?: number;
}

export interface AlertItem {
  id: string;
  vehicleId: string;
  followingVehicleId?: string;
  routeNumberBadge: string;
  routeId: string;
  urgencyBadge: string;
  urgencyMinutes: number;
  tag: string;
  tagType: 'bunching' | 'interval' | 'compression';
  title: string;
  delayLabel: string;
  description: string;
  confidence: number;
  locationName: string;
  latitude: number;
  longitude: number;
  category: 'all' | 'critical' | 'bunching';
  shapFactors: ShapFactor[];
  delayChartData: DelayChartPoint[];
  recommendation: Recommendation;
  metrics?: AlertMetrics;
}

export interface StopPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  color: string;
}

export interface RouteData {
  routeId: string;
  name: string;
  greenPolyline: [number, number][];
  orangePolyline: [number, number][];
  redCorridorPolyline: [number, number][];
  riskPolygon: [number, number][];
  stops: StopPoint[];
}

// ----------------- MOCK DATA DEFINITIONS -----------------

export const MOCK_SYSTEM_METRICS = {
  vehiclesOnLine: 412,
  punctualityRate: 94.8,
  activeIncidentsCount: 3,
  preventedIncidentsCount: 19,
  modelVersion: "RT-NEURAL - v4.2.1",
  engineLatencyMs: 3.2,
  simulationHorizon: "T+45 мин",
  maeAccuracy: "±1.2 мин",
  sector: "ВАО / ЦАО (Бауманский куст)",
  ebt: "4.2 ± 1.8",
  fps: "23 k/s",
  simulationTime: "14:30",
};

export const MOCK_STOPS: StopPoint[] = [
  { id: "s1", name: "м. Бауманская", lat: 55.7724, lon: 37.6791, color: "#f97316" },
  { id: "s2", name: "м. Семёновская", lat: 55.7831, lon: 37.7189, color: "#10b981" },
];

// Coordinates around Baumanskaya — Semyonovskaya in Moscow
export const MOCK_ROUTE_DATA: RouteData = {
  routeId: "м3",
  name: "Серебряный бор — Семёновская",
  greenPolyline: [
    [55.7612, 37.6475],
    [55.7674, 37.6681],
    [55.7724, 37.6791],
    [55.7831, 37.7189],
    [55.7890, 37.7340],
  ],
  orangePolyline: [
    [55.7550, 37.6700],
    [55.7650, 37.6750],
    [55.7724, 37.6791],
    [55.7800, 37.6830],
    [55.7950, 37.6900],
  ],
  redCorridorPolyline: [
    [55.7745, 37.6854],
    [55.7773, 37.6942],
    [55.7798, 37.7011],
    [55.7818, 37.7082],
    [55.7831, 37.7189],
  ],
  // Soft peach/coral shaded sector over the problematic stretch
  riskPolygon: [
    [55.7730, 37.6820],
    [55.7810, 37.7250],
    [55.7860, 37.7220],
    [55.7780, 37.6790],
  ],
  stops: MOCK_STOPS,
};

export const MOCK_VEHICLES: Vehicle[] = [
  {
    id: "P1042",
    badgeLabel: "P1042 - 14м",
    plateNumber: "В 042 АХ 777",
    model: "ЛиАЗ-6274 (Электробус)",
    routeId: "м3",
    routeName: "Серебряный бор — Семёновская",
    status: "BUNCHING_RISK",
    delaySeconds: 180,
    predictedTerminalDelayMinutes: 14,
    speedKmh: 14,
    latitude: 55.7773,
    longitude: 37.6942,
    heading: 68,
    currentStop: "Бакунинская ул., 84",
    nextStop: "м. Семёновская",
  },
  {
    id: "P1043",
    badgeLabel: "P1043 (в норме)",
    plateNumber: "Е 143 СК 777",
    model: "ЛиАЗ-6274 (Электробус)",
    routeId: "м3",
    routeName: "Серебряный бор — Семёновская",
    status: "NORMAL",
    delaySeconds: 15,
    predictedTerminalDelayMinutes: 2,
    speedKmh: 36,
    latitude: 55.7740,
    longitude: 37.6820,
    heading: 65,
    currentStop: "м. Бауманская",
    nextStop: "Бакунинская ул., 84",
  },
  {
    id: "P2198",
    badgeLabel: "P2198 - 9м",
    plateNumber: "С 198 КМ 777",
    model: "ЛиАЗ-6213.65 (Гармошка)",
    routeId: "м7",
    routeName: "Карачарово — 138-й кв. Выхина",
    status: "DELAYED",
    delaySeconds: 540,
    predictedTerminalDelayMinutes: 9,
    speedKmh: 11,
    latitude: 55.7512,
    longitude: 37.6621,
    heading: 115,
    currentStop: "ул. Николоямская",
    nextStop: "Таганская пл.",
  },
  {
    id: "P2199",
    badgeLabel: "P2199 (в норме)",
    plateNumber: "Е 199 КМ 777",
    model: "ЛиАЗ-6213.65 (Гармошка)",
    routeId: "м7",
    routeName: "Карачарово — 138-й кв. Выхина",
    status: "NORMAL",
    delaySeconds: 40,
    predictedTerminalDelayMinutes: 2,
    speedKmh: 31,
    latitude: 55.7540,
    longitude: 37.6550,
    heading: 115,
    currentStop: "Яузские Ворота",
    nextStop: "ул. Николоямская",
  },
  {
    id: "P0814",
    badgeLabel: "P0814 - 6м",
    plateNumber: "А 814 ТР 799",
    model: "ЛиАЗ-6274 (Электробус)",
    routeId: "т88",
    routeName: "Комсомольская пл. — м. Лубянка",
    status: "BUNCHING_RISK",
    delaySeconds: 360,
    predictedTerminalDelayMinutes: 6,
    speedKmh: 19,
    latitude: 55.7612,
    longitude: 37.6475,
    heading: 240,
    currentStop: "Старая Басманная ул.",
    nextStop: "Садовая-Черногрязская",
  },
  {
    id: "P0815",
    badgeLabel: "P0815 (в норме)",
    plateNumber: "В 815 ТР 799",
    model: "ЛиАЗ-6274 (Электробус)",
    routeId: "т88",
    routeName: "Комсомольская пл. — м. Лубянка",
    status: "NORMAL",
    delaySeconds: 25,
    predictedTerminalDelayMinutes: 1.5,
    speedKmh: 28,
    latitude: 55.7645,
    longitude: 37.6530,
    heading: 240,
    currentStop: "Доброслободская ул.",
    nextStop: "Старая Басманная ул.",
  },
];


export const MOCK_ALERTS: AlertItem[] = [
  {
    id: "alert_1042",
    vehicleId: "P1042",
    followingVehicleId: "P1043",
    routeNumberBadge: "м3",
    routeId: "м3",
    urgencyBadge: "ЧЕРЕЗ 22 МИН",
    urgencyMinutes: 22,
    tag: "РИСК Пачкования",
    tagType: "bunching",
    title: "Борт №1042",
    delayLabel: "+14 мин отставание",
    description: "Опережение на 1.2 мин, на 14 мин на перегоне отставание — Семёновская. Идущий следом борт №1043 догонит через 4 остановок.",
    confidence: 94,
    locationName: "м. Бауманская → Семёновская",
    latitude: 55.7773,
    longitude: 37.6942,
    category: "bunching",
    shapFactors: [
      {
        title: "Затор: Бауманская — Электрозаводская",
        delayMinutes: 5.0,
        percent: 45,
        color: "#ef4444",
      },
      {
        title: "Посадка пассажиров (осадки / дождь)",
        delayMinutes: 3.0,
        percent: 25,
        color: "#0284c7",
      },
      {
        title: "Светофорное регулирование ТТК-ДД",
        delayMinutes: 1.5,
        percent: 18,
        color: "#8b5cf6",
      },
    ],
    delayChartData: [
      { stop: "Покровка", plan: 10, withoutAction: 15, withHolding: 15 },
      { stop: "Доброслободская", plan: 20, withoutAction: 45, withHolding: 30 },
      { stop: "м. Бауманская", plan: 30, withoutAction: 85, withHolding: 52 },
      { stop: "м. Семёновская", plan: 45, withoutAction: 145, withHolding: 58 },
    ],
    recommendation: {
      id: "rec_1042",
      targetVehicleId: "№1043",
      durationSeconds: 150,
      durationMinutes: 2.5,
      stopName: "«Метро Бауманская»",
      effectPercent: 96,
      text: "Придержать идущий следом Борт №1043 на остановке «Метро Бауманская» на 2.5 минуты.",
      infoText: "Интервал восстановится с 2 мин до расчетных 7.5 мин. Пачкование будет устранено на всей линии.",
      applied: false,
    },
    metrics: {
      headway_collapse_sec: 96,
    },
  },
  {
    id: "alert_2198",
    vehicleId: "P2198",
    routeNumberBadge: "м7",
    routeId: "м7",
    urgencyBadge: "ЧЕРЕЗ 14 МИН",
    urgencyMinutes: 14,
    tag: "РИСК Интервала",
    tagType: "interval",
    title: "Борт №2198",
    delayLabel: "+9 мин",
    description: "Затор на ул. Николоямская, прогрессирующий срыв интервала 10 мин на выезде на Энтузиастов проспект.",
    confidence: 94,
    locationName: "ул. Николоямская",
    latitude: 55.7512,
    longitude: 37.6621,
    category: "critical",
    shapFactors: [
      {
        title: "Плотный трафик Таганский узел",
        delayMinutes: 4.8,
        percent: 52,
        color: "#ef4444",
      },
      {
        title: "Светофорный цикл (ЦОДД Т-12)",
        delayMinutes: 2.5,
        percent: 28,
        color: "#8b5cf6",
      },
      {
        title: "Пассажиропоток",
        delayMinutes: 1.7,
        percent: 20,
        color: "#f59e0b",
      },
    ],
    delayChartData: [
      { stop: "Покровка", plan: 10, withoutAction: 20, withHolding: 18 },
      { stop: "Доброслободская", plan: 25, withoutAction: 60, withHolding: 35 },
      { stop: "м. Бауманская", plan: 40, withoutAction: 110, withHolding: 48 },
      { stop: "м. Семёновская", plan: 50, withoutAction: 135, withHolding: 55 },
    ],
    recommendation: {
      id: "rec_2198",
      targetVehicleId: "№2199",
      durationSeconds: 120,
      durationMinutes: 2.0,
      stopName: "«Таганская площадь»",
      effectPercent: 89,
      text: "Корректировка зеленого коридора на узле Таганская + выравнивание интервала борта №2199.",
      infoText: "Интервал восстановится до планового расписания на Карачаровском направлении.",
      applied: false,
    },
  },
  {
    id: "alert_0814",
    vehicleId: "P0814",
    routeNumberBadge: "т88",
    routeId: "т88",
    urgencyBadge: "ЧЕРЕЗ 31 МИН",
    urgencyMinutes: 31,
    tag: "Сжатие 1.5м",
    tagType: "compression",
    title: "Борт №0814",
    delayLabel: "+6 мин",
    description: "Сжатие интервала на 1.5 мин перед м. Лубянка из-за светофорного цикла.",
    confidence: 98,
    locationName: "ул. Старая Басманная",
    latitude: 55.7612,
    longitude: 37.6475,
    category: "bunching",
    shapFactors: [
      {
        title: "Сужение полосы (дорожные работы)",
        delayMinutes: 3.2,
        percent: 60,
        color: "#ef4444",
      },
      {
        title: "Светофорная задержка",
        delayMinutes: 1.8,
        percent: 40,
        color: "#8b5cf6",
      },
    ],
    delayChartData: [
      { stop: "Покровка", plan: 10, withoutAction: 15, withHolding: 12 },
      { stop: "Доброслободская", plan: 20, withoutAction: 35, withHolding: 24 },
      { stop: "м. Бауманская", plan: 30, withoutAction: 65, withHolding: 35 },
      { stop: "м. Семёновская", plan: 45, withoutAction: 95, withHolding: 42 },
    ],
    recommendation: {
      id: "rec_0814",
      targetVehicleId: "№0815",
      durationSeconds: 90,
      durationMinutes: 1.5,
      stopName: "«Садовая-Черногрязская»",
      effectPercent: 92,
      text: "Динамический перепуск светофора через УДС ЦОДД для опережения затора.",
      infoText: "Выравнивание шага движения предотвратит накопление пассажиров на ТПУ.",
      applied: false,
    },
  },
];

export const MOCK_CAMERA = {
  id: "ВА2-842",
  location: "Бауманская",
  status: "LIVE",
  footerText: "Загрузка событий, Бауманская",
};
