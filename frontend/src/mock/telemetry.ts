export interface ShapFactor {
  title: string;
  delayMinutes: number;
  percent: number;
  color: string;
  category: 'traffic' | 'weather' | 'lights' | 'boarding';
}

export interface DelayChartPoint {
  stop: string;
  plan: number;
  withoutAction: number;
  withHolding: number;
  isPassed?: boolean;
}

export interface Recommendation {
  id: string;
  targetVehicleId: string;
  durationSeconds: number;
  durationMinutes: number;
  stopName: string;
  effectPercent: number;
  text: string;
  restoredHeadwayMinutes: number;
  applied: boolean;
}

export interface Vehicle {
  id: string;
  model: string;
  routeId: string;
  routeName: string;
  status: 'BUNCHING_RISK' | 'NORMAL' | 'DELAYED';
  delaySeconds: number;
  predictedTerminalDelayMinutes: number;
  headwaySeconds: number;
  plannedHeadwaySeconds: number;
  speedKmh: number;
  latitude: number;
  longitude: number;
  heading: number;
  currentStop: string;
  nextStop: string;
  driver: string;
  occupancyPercent: number;
  plateNumber: string;
}

export interface AlertItem {
  id: string;
  vehicleId: string;
  followingVehicleId?: string;
  routeId: string;
  urgencyMinutes: number;
  urgencyBadge: string;
  urgencyLevel: 'critical' | 'high' | 'medium';
  type: 'bunching' | 'interval' | 'delay';
  tag: string;
  title: string;
  description: string;
  confidence: number;
  locationName: string;
  latitude: number;
  longitude: number;
  category: 'all' | 'critical' | 'bunching';
  shapFactors: ShapFactor[];
  delayChartData: DelayChartPoint[];
  recommendation: Recommendation;
}

export interface StopPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  isRiskZone?: boolean;
  isHoldingPoint?: boolean;
  subwayTransfer?: string;
}

export interface RouteData {
  routeId: string;
  name: string;
  normalPolyline: [number, number][];
  riskPolyline: [number, number][];
  stops: StopPoint[];
}

// ----------------- MOCK DATA DEFINITIONS -----------------

export const MOCK_SYSTEM_METRICS = {
  vehiclesOnLine: 412,
  punctualityRate: 94.8,
  activeIncidentsCount: 3,
  preventedIncidentsCount: 19,
  modelVersion: "RT-NEURAL v4.2.1",
  engineLatencyMs: 3.2,
  simulationTime: "14:30",
};

export const MOCK_STOPS: StopPoint[] = [
  { id: "s1", name: "Метро Лубянка", lat: 55.7591, lon: 37.6277, subwayTransfer: "Сокольническая" },
  { id: "s2", name: "Покровские Ворота", lat: 55.7612, lon: 37.6475 },
  { id: "s3", name: "Доброслободская", lat: 55.7674, lon: 37.6681 },
  { id: "s4", name: "Метро Бауманская", lat: 55.7724, lon: 37.6791, isHoldingPoint: true, subwayTransfer: "Арбатско-Покровская" },
  { id: "s5", name: "Бакунинская ул., 84", lat: 55.7773, lon: 37.6942, isRiskZone: true },
  { id: "s6", name: "Метро Электрозаводская", lat: 55.7818, lon: 37.7052, isRiskZone: true, subwayTransfer: "БКЛ / АПЛ" },
  { id: "s7", name: "Метро Семёновская", lat: 55.7831, lon: 37.7189, isRiskZone: true, subwayTransfer: "Арбатско-Покровская" },
];

// Coordinates for route m3 in Moscow
export const MOCK_ROUTE_M3: RouteData = {
  routeId: "м3",
  name: "Серебряный бор — Метро Семёновская",
  normalPolyline: [
    [55.7591, 37.6277],
    [55.7599, 37.6362],
    [55.7612, 37.6475],
    [55.7645, 37.6582],
    [55.7674, 37.6681],
    [55.7701, 37.6738],
    [55.7724, 37.6791], // Метро Бауманская
  ],
  riskPolyline: [
    [55.7724, 37.6791], // Метро Бауманская
    [55.7745, 37.6854],
    [55.7773, 37.6942], // Бакунинская 84
    [55.7798, 37.7011],
    [55.7818, 37.7052], // Электрозаводская
    [55.7825, 37.7120],
    [55.7831, 37.7189], // Метро Семёновская
  ],
  stops: MOCK_STOPS,
};

export const MOCK_VEHICLES: Vehicle[] = [
  {
    id: "P1042",
    plateNumber: "В 042 АХ 777",
    model: "ЛиАЗ-6274 (Электробус)",
    routeId: "м3",
    routeName: "Серебряный бор — Семёновская",
    status: "BUNCHING_RISK",
    delaySeconds: 180, // +3 min current delay
    predictedTerminalDelayMinutes: 16,
    headwaySeconds: 95, // 1.5 min headway to next
    plannedHeadwaySeconds: 480, // 8 min schedule
    speedKmh: 14,
    latitude: 55.7745,
    longitude: 37.6854,
    heading: 65,
    currentStop: "Бауманская ул.",
    nextStop: "Бакунинская ул., 84",
    driver: "Смирнов А. В.",
    occupancyPercent: 82,
  },
  {
    id: "P1043",
    plateNumber: "Е 143 СК 777",
    model: "ЛиАЗ-6274 (Электробус)",
    routeId: "м3",
    routeName: "Серебряный бор — Семёновская",
    status: "NORMAL",
    delaySeconds: 15,
    predictedTerminalDelayMinutes: 2,
    headwaySeconds: 480,
    plannedHeadwaySeconds: 480,
    speedKmh: 36,
    latitude: 55.7701,
    longitude: 37.6738,
    heading: 62,
    currentStop: "Доброслободская",
    nextStop: "Метро Бауманская",
    driver: "Кузнецов М. И.",
    occupancyPercent: 44,
  },
  {
    id: "P2198",
    plateNumber: "О 198 РР 799",
    model: "КамАЗ-6282 (Электробус)",
    routeId: "м7",
    routeName: "Парк Победы — Карачаровский путепровод",
    status: "DELAYED",
    delaySeconds: 540, // +9 min
    predictedTerminalDelayMinutes: 14,
    headwaySeconds: 220,
    plannedHeadwaySeconds: 600,
    speedKmh: 18,
    latitude: 55.7512,
    longitude: 37.6621,
    heading: 110,
    currentStop: "Николоямская ул.",
    nextStop: "Андроньевская пл.",
    driver: "Васильев Д. П.",
    occupancyPercent: 91,
  },
  {
    id: "P1055",
    plateNumber: "Т 055 ММ 777",
    model: "ЛиАЗ-6274 (Электробус)",
    routeId: "т25",
    routeName: "Проспект Буденного — Метро Лубянка",
    status: "NORMAL",
    delaySeconds: 30,
    predictedTerminalDelayMinutes: 1,
    headwaySeconds: 420,
    plannedHeadwaySeconds: 420,
    speedKmh: 31,
    latitude: 55.7612,
    longitude: 37.6475,
    heading: 240,
    currentStop: "Покровские Ворота",
    nextStop: "Метро Лубянка",
    driver: "Алексеев П. С.",
    occupancyPercent: 53,
  },
];

export const MOCK_ALERTS: AlertItem[] = [
  {
    id: "alert_m3_001",
    vehicleId: "P1042",
    followingVehicleId: "P1043",
    routeId: "м3",
    urgencyMinutes: 22,
    urgencyBadge: "ЧЕРЕЗ 22 МИН",
    urgencyLevel: "critical",
    type: "bunching",
    tag: "РИСК Пачкования",
    title: "Борт №1042 (+14 мин отставание)",
    description: "Прогноз сближения с идущим следом бортом №1043 через 4 остановки. Интервал сократится до 1.5 мин на перегоне Бауманская — Семёновская.",
    confidence: 94,
    locationName: "м. Бауманская → Семёновская",
    latitude: 55.7724,
    longitude: 37.6791,
    category: "bunching",
    shapFactors: [
      {
        title: "Затор на перегоне Бакунинская",
        delayMinutes: 5.0,
        percent: 45,
        color: "#ef4444",
        category: "traffic",
      },
      {
        title: "Посадка пассажиров (осадки / дождь)",
        delayMinutes: 3.0,
        percent: 25,
        color: "#2563eb",
        category: "weather",
      },
      {
        title: "Светофорное регулирование ТТК",
        delayMinutes: 1.5,
        percent: 18,
        color: "#8b5cf6",
        category: "lights",
      },
      {
        title: "Интенсивность посадки на ТПУ",
        delayMinutes: 1.0,
        percent: 12,
        color: "#f59e0b",
        category: "boarding",
      },
    ],
    delayChartData: [
      { stop: "Лубянка", plan: 0, withoutAction: 0, withHolding: 0, isPassed: true },
      { stop: "Покровка", plan: 0, withoutAction: 1.2, withHolding: 1.2, isPassed: true },
      { stop: "Бауманская", plan: 0, withoutAction: 3.0, withHolding: 3.0, isPassed: true },
      { stop: "Бакунинская", plan: 0, withoutAction: 8.5, withHolding: 3.8 },
      { stop: "Электрозавод.", plan: 0, withoutAction: 12.8, withHolding: 3.2 },
      { stop: "Семёновская", plan: 0, withoutAction: 16.0, withHolding: 2.5 },
    ],
    recommendation: {
      id: "rec_m3_1042",
      targetVehicleId: "1043",
      durationSeconds: 150,
      durationMinutes: 2.5,
      stopName: "Метро Бауманская",
      effectPercent: 96,
      text: "Придержать идущий следом борт №1043 на остановке \"Метро Бауманская\" на 2.5 минуты. Интервал восстановится до 7.5 мин.",
      restoredHeadwayMinutes: 7.5,
      applied: false,
    },
  },
  {
    id: "alert_m7_002",
    vehicleId: "P2198",
    routeId: "м7",
    urgencyMinutes: 14,
    urgencyBadge: "ЧЕРЕЗ 14 МИН",
    urgencyLevel: "critical",
    type: "interval",
    tag: "Срыв интервала",
    title: "Борт №2198 (+9 мин)",
    description: "Нарастающее отставание по трассе Таганской площади. Риск выпадения борта из расчетного расписания на Карачаровском направлении.",
    confidence: 88,
    locationName: "Таганская площадь",
    latitude: 55.7512,
    longitude: 37.6621,
    category: "critical",
    shapFactors: [
      {
        title: "Плотный трафик Таганский тоннель",
        delayMinutes: 4.8,
        percent: 52,
        color: "#ef4444",
        category: "traffic",
      },
      {
        title: "Сбой фазы светофора (ЦОДД Т-12)",
        delayMinutes: 2.5,
        percent: 28,
        color: "#8b5cf6",
        category: "lights",
      },
      {
        title: "Увеличенный пассажиропоток",
        delayMinutes: 1.7,
        percent: 20,
        color: "#f59e0b",
        category: "boarding",
      },
    ],
    delayChartData: [
      { stop: "Китай-город", plan: 0, withoutAction: 2.0, withHolding: 2.0, isPassed: true },
      { stop: "Солянка", plan: 0, withoutAction: 4.5, withHolding: 4.5, isPassed: true },
      { stop: "Таганская", plan: 0, withoutAction: 9.0, withHolding: 5.0 },
      { stop: "Нижегородская", plan: 0, withoutAction: 14.0, withHolding: 4.2 },
    ],
    recommendation: {
      id: "rec_m7_2198",
      targetVehicleId: "2198",
      durationSeconds: 120,
      durationMinutes: 2.0,
      stopName: "Метро Таганская",
      effectPercent: 89,
      text: "Корректировка фазы зеленого коридора на узле Таганская + выравнивание интервала борта №2199.",
      restoredHeadwayMinutes: 8.0,
      applied: false,
    },
  },
  {
    id: "alert_m3_003",
    vehicleId: "P1055",
    routeId: "т25",
    urgencyMinutes: 8,
    urgencyBadge: "ЧЕРЕЗ 8 МИН",
    urgencyLevel: "medium",
    type: "delay",
    tag: "Критич. отставание",
    title: "Борт №1055 (+5 мин)",
    description: "Локальное замедление в зоне дорожных работ на Старой Басманной ул. Интервал умеренно расширен.",
    confidence: 79,
    locationName: "ул. Старая Басманная",
    latitude: 55.7612,
    longitude: 37.6475,
    category: "all",
    shapFactors: [
      {
        title: "Сужение полосы (дорожные работы)",
        delayMinutes: 3.2,
        percent: 60,
        color: "#ef4444",
        category: "traffic",
      },
      {
        title: "Светофорная задержка",
        delayMinutes: 1.8,
        percent: 40,
        color: "#8b5cf6",
        category: "lights",
      },
    ],
    delayChartData: [
      { stop: "Будённого", plan: 0, withoutAction: 0, withHolding: 0, isPassed: true },
      { stop: "Басманная", plan: 0, withoutAction: 3.2, withHolding: 2.0 },
      { stop: "Лубянка", plan: 0, withoutAction: 5.4, withHolding: 1.8 },
    ],
    recommendation: {
      id: "rec_t25_1055",
      targetVehicleId: "1055",
      durationSeconds: 90,
      durationMinutes: 1.5,
      stopName: "Садовая-Черногрязская",
      effectPercent: 82,
      text: "Динамический перепуск светофора через систему УДС ЦОДД для опережения затора.",
      restoredHeadwayMinutes: 6.5,
      applied: false,
    },
  },
];

export const MOCK_CAMERA = {
  id: "ВА2-842",
  location: "Бауманская (LIVE)",
  intersection: "ул. Бауманская / Бакунинская",
  status: "ONLINE",
  resolution: "1080p • 25 FPS",
  streamUrl: "rtsp://cctv.codd.mos.ru/live/va2-842",
  congestionLevel: "7/10 (Плотный трафик)",
};
