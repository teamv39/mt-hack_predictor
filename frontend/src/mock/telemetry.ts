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
  action?: string;
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
  color: string;
  routeGeometry: [number, number][];
  congestionSegment: [number, number][];
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
  { id: "s1", name: "ул. Покровка", lat: 55.7588, lon: 37.6497, color: "#71717a" },
  { id: "s2", name: "Лялин пер.", lat: 55.7585, lon: 37.6598, color: "#71717a" },
  { id: "s3", name: "м. Бауманская", lat: 55.7724, lon: 37.6791, color: "#f97316" },
  { id: "s4", name: "Бакунинская ул.", lat: 55.7785, lon: 37.6970, color: "#d97706" },
  { id: "s5", name: "м. Электрозаводская", lat: 55.7818, lon: 37.7082, color: "#0284c7" },
  { id: "s6", name: "м. Семёновская", lat: 55.7868, lon: 37.7225, color: "#10b981" },
];

// Реальная трасса м3: Покровка → Лялин → Бауманская → Бакунинская → Электрозаводская → Семёновская
// По улицам: Покровка → Старая Басманная → Спартаковская → Бакунинская → Бол. Семёновская
export const MOCK_ROUTE_DATA: RouteData = {
  routeId: "м3",
  name: "Серебряный бор — Семёновская",
  color: "#10b981",
  routeGeometry: [
    [37.6497, 55.7588], // ул. Покровка
    [37.6598, 55.7585], // Лялин пер.
    [37.6680, 55.7630], // Старая Басманная
    [37.6735, 55.7665], // Спартаковская
    [37.6791, 55.7724], // м. Бауманская
    [37.6855, 55.7750], // Бакунинская ул., начало
    [37.6970, 55.7785], // Бакунинская ул.
    [37.7020, 55.7802], // Бакунинская д.84
    [37.7082, 55.7818], // м. Электрозаводская
    [37.7155, 55.7845], // Бол. Семёновская
    [37.7225, 55.7868], // м. Семёновская
  ],
  congestionSegment: [
    [37.6791, 55.7724], // м. Бауманская
    [37.6970, 55.7785], // Бакунинская
    [37.7082, 55.7818], // м. Электрозаводская
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
  // --- Маршрут м7: доп. борт ---
  {
    id: "P2200",
    badgeLabel: "P2200 (в норме)",
    plateNumber: "К 200 ВА 777",
    model: "ЛиАЗ-6213.65 (Гармошка)",
    routeId: "м7",
    routeName: "Карачарово — 138-й кв. Выхина",
    status: "NORMAL",
    delaySeconds: 30,
    predictedTerminalDelayMinutes: 1,
    speedKmh: 35,
    latitude: 55.7435,
    longitude: 37.6880,
    heading: 90,
    currentStop: "Рогожский вал",
    nextStop: "Площадь Ильича",
  },
  // --- Маршрут т88: доп. борт ---
  {
    id: "P0816",
    badgeLabel: "P0816 (в норме)",
    plateNumber: "Н 816 ТР 799",
    model: "ЛиАЗ-6274 (Электробус)",
    routeId: "т88",
    routeName: "Комсомольская пл. — м. Лубянка",
    status: "NORMAL",
    delaySeconds: 20,
    predictedTerminalDelayMinutes: 1,
    speedKmh: 32,
    latitude: 55.7570,
    longitude: 37.6380,
    heading: 220,
    currentStop: "Красные Ворота",
    nextStop: "Мясницкая",
  },
  // --- Маршрут м3: доп. борт ---
  {
    id: "P1044",
    badgeLabel: "P1044 (в норме)",
    plateNumber: "М 044 КХ 799",
    model: "ЛиАЗ-6274 (Электробус)",
    routeId: "м3",
    routeName: "Серебряный бор — Семёновская",
    status: "NORMAL",
    delaySeconds: 10,
    predictedTerminalDelayMinutes: 0.5,
    speedKmh: 40,
    latitude: 55.7588,
    longitude: 37.6510,
    heading: 60,
    currentStop: "ул. Покровка",
    nextStop: "Лялин пер.",
  },
  // --- Маршрут 24: три борта ---
  {
    id: "P3501",
    badgeLabel: "P3501 (в норме)",
    plateNumber: "А 501 МК 777",
    model: "ЛиАЗ-5292 (Дизель)",
    routeId: "24",
    routeName: "Курский вокзал — Елоховская",
    status: "NORMAL",
    delaySeconds: 45,
    predictedTerminalDelayMinutes: 1.5,
    speedKmh: 28,
    latitude: 55.7610,
    longitude: 37.6650,
    heading: 45,
    currentStop: "Земляной вал",
    nextStop: "Чкаловская",
  },
  {
    id: "P3502",
    badgeLabel: "P3502 (в норме)",
    plateNumber: "Е 502 МК 777",
    model: "ЛиАЗ-5292 (Дизель)",
    routeId: "24",
    routeName: "Курский вокзал — Елоховская",
    status: "NORMAL",
    delaySeconds: 20,
    predictedTerminalDelayMinutes: 1,
    speedKmh: 33,
    latitude: 55.7680,
    longitude: 37.6760,
    heading: 40,
    currentStop: "Бауманская ул.",
    nextStop: "Бауманская д.58",
  },
  {
    id: "P3503",
    badgeLabel: "P3503 - 4м",
    plateNumber: "С 503 МК 777",
    model: "ЛиАЗ-5292 (Дизель)",
    routeId: "24",
    routeName: "Курский вокзал — Елоховская",
    status: "DELAYED",
    delaySeconds: 240,
    predictedTerminalDelayMinutes: 4,
    speedKmh: 15,
    latitude: 55.7760,
    longitude: 37.6960,
    heading: 35,
    currentStop: "Елоховская",
    nextStop: "Разгуляй",
  },
  // --- Маршрут 40к: два борта ---
  {
    id: "P4001",
    badgeLabel: "P4001 - 5м",
    plateNumber: "Р 001 НН 799",
    model: "КамАЗ-6282 (Электробус)",
    routeId: "40к",
    routeName: "Сокольники — Лефортово",
    status: "DELAYED",
    delaySeconds: 300,
    predictedTerminalDelayMinutes: 5,
    speedKmh: 12,
    latitude: 55.7850,
    longitude: 37.6810,
    heading: 180,
    currentStop: "Русаковская",
    nextStop: "Бакунинская ул.",
  },
  {
    id: "P4002",
    badgeLabel: "P4002 (в норме)",
    plateNumber: "В 002 НН 799",
    model: "КамАЗ-6282 (Электробус)",
    routeId: "40к",
    routeName: "Сокольники — Лефортово",
    status: "NORMAL",
    delaySeconds: 15,
    predictedTerminalDelayMinutes: 0.5,
    speedKmh: 38,
    latitude: 55.7750,
    longitude: 37.6900,
    heading: 180,
    currentStop: "Спартаковская",
    nextStop: "Денисовский пер.",
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

// ---- MULTI-ROUTE DEFINITIONS ----

const MOCK_STOPS_M7: StopPoint[] = [
  { id: "s_m7_1", name: "Яузские Ворота", lat: 55.7520, lon: 37.6400, color: "#3b82f6" },
  { id: "s_m7_2", name: "ул. Николоямская", lat: 55.7540, lon: 37.6550, color: "#71717a" },
  { id: "s_m7_3", name: "Николоямская д.84", lat: 55.7512, lon: 37.6621, color: "#f97316" },
  { id: "s_m7_4", name: "Таганская пл.", lat: 55.7465, lon: 37.6695, color: "#f97316" },
  { id: "s_m7_5", name: "Марксистская", lat: 55.7440, lon: 37.6785, color: "#71717a" },
  { id: "s_m7_6", name: "Рогожский вал", lat: 55.7435, lon: 37.6880, color: "#71717a" },
  { id: "s_m7_7", name: "Площадь Ильича", lat: 55.7455, lon: 37.6940, color: "#10b981" },
];

export const MOCK_ROUTE_M7: RouteData = {
  routeId: "м7",
  name: "Карачарово — 138-й кв. Выхина",
  color: "#3b82f6",
  routeGeometry: [
    [37.6400, 55.7520],
    [37.6465, 55.7502],
    [37.6550, 55.7540],
    [37.6621, 55.7512],
    [37.6695, 55.7465],
    [37.6785, 55.7440],
    [37.6880, 55.7435],
    [37.6940, 55.7455],
  ],
  congestionSegment: [
    [37.6550, 55.7540],
    [37.6621, 55.7512],
    [37.6695, 55.7465],
  ],
  stops: MOCK_STOPS_M7,
};

const MOCK_STOPS_T88: StopPoint[] = [
  { id: "s_t88_1", name: "Комсомольская пл.", lat: 55.7760, lon: 37.6580, color: "#8b5cf6" },
  { id: "s_t88_2", name: "Новая Басманная", lat: 55.7720, lon: 37.6545, color: "#71717a" },
  { id: "s_t88_3", name: "Доброслободская ул.", lat: 55.7645, lon: 37.6530, color: "#71717a" },
  { id: "s_t88_4", name: "Старая Басманная", lat: 55.7612, lon: 37.6475, color: "#f97316" },
  { id: "s_t88_5", name: "Красные Ворота", lat: 55.7570, lon: 37.6380, color: "#71717a" },
  { id: "s_t88_6", name: "Лубянка", lat: 55.7555, lon: 37.6260, color: "#10b981" },
];

export const MOCK_ROUTE_T88: RouteData = {
  routeId: "т88",
  name: "Комсомольская пл. — м. Лубянка",
  color: "#8b5cf6",
  routeGeometry: [
    [37.6580, 55.7760],
    [37.6545, 55.7720],
    [37.6530, 55.7645],
    [37.6475, 55.7612],
    [37.6430, 55.7590],
    [37.6380, 55.7570],
    [37.6320, 55.7560],
    [37.6260, 55.7555],
  ],
  congestionSegment: [
    [37.6530, 55.7645],
    [37.6475, 55.7612],
    [37.6430, 55.7590],
  ],
  stops: MOCK_STOPS_T88,
};

const MOCK_STOPS_24: StopPoint[] = [
  { id: "s_24_1", name: "Курский вокзал", lat: 55.7580, lon: 37.6610, color: "#06b6d4" },
  { id: "s_24_2", name: "Земляной вал", lat: 55.7610, lon: 37.6650, color: "#71717a" },
  { id: "s_24_3", name: "Чкаловская", lat: 55.7640, lon: 37.6700, color: "#71717a" },
  { id: "s_24_4", name: "Бауманская ул.", lat: 55.7680, lon: 37.6760, color: "#71717a" },
  { id: "s_24_5", name: "Бауманская д.58", lat: 55.7720, lon: 37.6850, color: "#71717a" },
  { id: "s_24_6", name: "Елоховская", lat: 55.7760, lon: 37.6960, color: "#06b6d4" },
];

export const MOCK_ROUTE_24: RouteData = {
  routeId: "24",
  name: "Курский вокзал — Елоховская",
  color: "#06b6d4",
  routeGeometry: [
    [37.6610, 55.7580],
    [37.6650, 55.7610],
    [37.6700, 55.7640],
    [37.6760, 55.7680],
    [37.6850, 55.7720],
    [37.6960, 55.7760],
  ],
  congestionSegment: [],
  stops: MOCK_STOPS_24,
};

const MOCK_STOPS_40K: StopPoint[] = [
  { id: "s_40k_1", name: "Сокольники", lat: 55.7900, lon: 37.6800, color: "#f59e0b" },
  { id: "s_40k_2", name: "Русаковская", lat: 55.7850, lon: 37.6810, color: "#f97316" },
  { id: "s_40k_3", name: "Бакунинская ул.", lat: 55.7800, lon: 37.6850, color: "#71717a" },
  { id: "s_40k_4", name: "Спартаковская", lat: 55.7750, lon: 37.6900, color: "#71717a" },
  { id: "s_40k_5", name: "Денисовский пер.", lat: 55.7700, lon: 37.6950, color: "#71717a" },
  { id: "s_40k_6", name: "Лефортово", lat: 55.7650, lon: 37.7000, color: "#f59e0b" },
];

export const MOCK_ROUTE_40K: RouteData = {
  routeId: "40к",
  name: "Сокольники — Лефортово",
  color: "#f59e0b",
  routeGeometry: [
    [37.6800, 55.7900],
    [37.6810, 55.7850],
    [37.6850, 55.7800],
    [37.6900, 55.7750],
    [37.6950, 55.7700],
    [37.7000, 55.7650],
  ],
  congestionSegment: [],
  stops: MOCK_STOPS_40K,
};

export const MOCK_ALL_ROUTES: RouteData[] = [
  MOCK_ROUTE_DATA,
  MOCK_ROUTE_M7,
  MOCK_ROUTE_T88,
  MOCK_ROUTE_24,
  MOCK_ROUTE_40K,
];
