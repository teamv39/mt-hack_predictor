/**
 * GPS Demo Simulation Engine (5-7 minute loop)
 * 
 * Provides smooth, realistic GPS-based movement of 12 Moscow buses across
 * real routes (m3, m7, t88, 24, 40k) with a scripted timeline:
 * - 0:00 - 1:15: Normal traffic, 7.5-8.0 min nominal headway, green status.
 * - 1:15 - 2:45: Congestion emerges on Bakuninskaya. Trailing bus P1042 slows down.
 *                ML Predictor triggers T+15m Bus Bunching alert (headway collapses to 1.4m).
 *                Connector line & risk sector light up on map.
 * - 2:45 - 4:00: Dispatcher intervention window: Holding recommendation (delay leader P1043 at Baumanskaya).
 *                Interactive What-if scenario matrix available.
 * - 4:00 - 5:15: Holding applied: leader P1043 halts, headway dynamically recovers to 7.8m.
 *                Alert resolves, prevented count increments, punctuality rises.
 * - 5:15 - 6:00: Smooth loop wrap-around.
 * 
 * Complies strictly with Zero Emojis Policy and standard DSS dispatcher aesthetics.
 */

import {
  Vehicle,
  AlertItem,
  RouteData,
  MOCK_ALL_ROUTES,
  MOCK_VEHICLES,
  MOCK_ALERTS,
  MOCK_SYSTEM_METRICS,
} from "../mock/telemetry";

export const LOOP_DURATION_SECONDS = 360; // 6 minutes total cycle

export interface SimulationState {
  simTime: number; // 0 .. 360
  timeFormatted: string; // "MM:SS"
  isPlaying: boolean;
  speed: number; // 1, 2, 5
  isHoldingApplied: boolean;
  holdingRemainingSec: number;
  appliedScenarioId: string | null;
  vehicles: Vehicle[];
  alerts: AlertItem[];
  metrics: typeof MOCK_SYSTEM_METRICS;
}

// Haversine distance in kilometers
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Heading in degrees (0..360)
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

interface PrecomputedRoute {
  routeId: string;
  points: [number, number][]; // [lon, lat]
  cumDistances: number[]; // km
  totalLengthKm: number;
}

// Precompute cumulative distances along each route polyline
function precomputeRoutes(routes: RouteData[]): Map<string, PrecomputedRoute> {
  const map = new Map<string, PrecomputedRoute>();
  for (const r of routes) {
    const pts = r.routeGeometry;
    if (pts.length < 2) continue;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      cum.push(cum[i - 1] + haversineKm(prev[1], prev[0], curr[1], curr[0]));
    }
    map.set(r.routeId, {
      routeId: r.routeId,
      points: pts,
      cumDistances: cum,
      totalLengthKm: cum[cum.length - 1] || 1,
    });
  }
  return map;
}

// Interpolate position [lon, lat] and heading along route for progress in [0..1]
function interpolatePosition(
  route: PrecomputedRoute,
  progress: number
): { lat: number; lon: number; heading: number } {
  const norm = ((progress % 1) + 1) % 1;
  const targetDist = norm * route.totalLengthKm;
  const cum = route.cumDistances;
  const pts = route.points;

  let idx = 0;
  while (idx < cum.length - 2 && cum[idx + 1] < targetDist) {
    idx++;
  }

  const segStartDist = cum[idx];
  const segEndDist = cum[idx + 1];
  const segSpan = segEndDist - segStartDist;
  const segRatio = segSpan > 0 ? (targetDist - segStartDist) / segSpan : 0;

  const p1 = pts[idx];
  const p2 = pts[idx + 1];
  const lon = p1[0] + (p2[0] - p1[0]) * segRatio;
  const lat = p1[1] + (p2[1] - p1[1]) * segRatio;
  const heading = Math.round(calculateBearing(p1[1], p1[0], p2[1], p2[0]));

  return { lat, lon, heading };
}

// Initial vehicle base offsets along their respective route loops
const VEHICLE_CONFIGS: {
  id: string;
  routeId: string;
  baseProgress: number; // 0..1
  speedMultiplier: number;
}[] = [
  // Route м3: 3 buses
  { id: "P1042", routeId: "м3", baseProgress: 0.38, speedMultiplier: 1.0 }, // Trailing bus that gets jammed
  { id: "P1043", routeId: "м3", baseProgress: 0.52, speedMultiplier: 1.0 }, // Leader bus to be held
  { id: "P1044", routeId: "м3", baseProgress: 0.85, speedMultiplier: 0.95 },
  // Route m7: 2 buses
  { id: "P2198", routeId: "m7", baseProgress: 0.25, speedMultiplier: 1.05 },
  { id: "P2199", routeId: "m7", baseProgress: 0.70, speedMultiplier: 1.0 },
  // Route t88: 2 buses
  { id: "P0814", routeId: "t88", baseProgress: 0.15, speedMultiplier: 0.98 },
  { id: "P0815", routeId: "t88", baseProgress: 0.65, speedMultiplier: 1.02 },
  // Route 24: 3 buses
  { id: "P3501", routeId: "24", baseProgress: 0.10, speedMultiplier: 1.0 },
  { id: "P3502", routeId: "24", baseProgress: 0.45, speedMultiplier: 1.0 },
  { id: "P3503", routeId: "24", baseProgress: 0.80, speedMultiplier: 0.95 },
  // Route 40k: 2 buses
  { id: "P4001", routeId: "40k", baseProgress: 0.20, speedMultiplier: 1.05 },
  { id: "P4002", routeId: "40k", baseProgress: 0.70, speedMultiplier: 1.0 },
];

export class GPSDemoEngine {
  private simTime: number = 0; // seconds
  private isPlaying: boolean = true;
  private speed: number = 1.0;
  private isHoldingApplied: boolean = false;
  private holdingRemainingSec: number = 150;
  private appliedScenarioId: string | null = null;
  private dismissedAlertIds: Set<string> = new Set();

  private precomputedRoutes: Map<string, PrecomputedRoute>;
  private listeners: Set<(state: SimulationState) => void> = new Set();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.precomputedRoutes = precomputeRoutes(MOCK_ALL_ROUTES);
  }

  public start(): void {
    if (this.timer) return;
    const intervalMs = 1000;
    this.timer = setInterval(() => {
      if (this.isPlaying) {
        this.step(this.speed);
      }
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public step(deltaSeconds: number): void {
    this.simTime += deltaSeconds;

    if (this.simTime >= LOOP_DURATION_SECONDS) {
      this.simTime = 0;
      this.isHoldingApplied = false;
      this.holdingRemainingSec = 150;
      this.appliedScenarioId = null;
    }

    if (this.isHoldingApplied && this.holdingRemainingSec > 0) {
      this.holdingRemainingSec = Math.max(0, this.holdingRemainingSec - deltaSeconds);
    }

    this.notify();
  }

  public play(): void {
    this.isPlaying = true;
    this.notify();
  }

  public pause(): void {
    this.isPlaying = false;
    this.notify();
  }

  public setSpeed(speed: number): void {
    this.speed = speed;
    this.notify();
  }

  public seek(seconds: number): void {
    this.simTime = Math.max(0, Math.min(LOOP_DURATION_SECONDS, seconds));
    this.notify();
  }

  public reset(): void {
    this.simTime = 0;
    this.isHoldingApplied = false;
    this.holdingRemainingSec = 150;
    this.appliedScenarioId = null;
    this.dismissedAlertIds.clear();
    this.notify();
  }

  public applyHolding(alertId?: string): void {
    this.isHoldingApplied = true;
    this.holdingRemainingSec = 150;
    this.appliedScenarioId = "holding";
    this.notify();
  }

  public applyScenario(scenarioId: string, alertId?: string): void {
    this.isHoldingApplied = true;
    this.holdingRemainingSec = 150;
    this.appliedScenarioId = scenarioId;
    this.notify();
  }

  public dismissAlert(alertId: string): void {
    this.dismissedAlertIds.add(alertId);
    this.notify();
  }

  public subscribe(listener: (state: SimulationState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  public getState(): SimulationState {
    const t = this.simTime;
    const isHolding = this.isHoldingApplied;

    // Calculate dynamic vehicle positions
    const updatedVehicles: Vehicle[] = MOCK_VEHICLES.map((baseVeh) => {
      const cfg = VEHICLE_CONFIGS.find((c) => c.id === baseVeh.id);
      if (!cfg) return baseVeh;

      const route = this.precomputedRoutes.get(cfg.routeId);
      if (!route) return baseVeh;

      // Base progress moves 1 full loop over 360 seconds
      let loopProgress = (t / LOOP_DURATION_SECONDS) * cfg.speedMultiplier;

      let speedKmh = 28;
      let delaySeconds = 0;
      let status: Vehicle["status"] = "NORMAL";

      // --- SCRIPTED INCIDENTS LOGIC ---
      if (baseVeh.id === "P1042") {
        // Trailing bus that encounters congestion between 75s and 270s
        if (t >= 75 && t < 240) {
          // Slows down significantly due to traffic on Bakuninskaya
          loopProgress *= 0.65;
          speedKmh = isHolding ? 24 : 12;
          delaySeconds = Math.round(60 + (t - 75) * 1.2);
          status = isHolding ? "NORMAL" : "BUNCHING_RISK";
        } else if (t >= 240) {
          // Clears traffic, recovers speed
          speedKmh = 32;
          delaySeconds = isHolding ? 45 : 180;
          status = "NORMAL";
        }
      } else if (baseVeh.id === "P1043") {
        // Leader bus
        if (isHolding && this.holdingRemainingSec > 0 && t >= 75 && t < 270) {
          // Executing holding standstill at metro Baumanskaya
          speedKmh = 0;
          status = "NORMAL";
          delaySeconds = 120;
          loopProgress *= 0.4; // Holds in place
        } else {
          speedKmh = 30;
          status = "NORMAL";
        }
      } else if (baseVeh.id === "P2198") {
        // Route m7 congestion alert
        if (t >= 110 && t < 300) {
          speedKmh = 14;
          delaySeconds = 240;
          status = "DELAYED";
        }
      } else if (baseVeh.id === "P0814") {
        // Route t88 compression alert
        if (t >= 140 && t < 320) {
          speedKmh = 18;
          delaySeconds = 90;
          status = "DELAYED";
        }
      }

      const totalProgress = (cfg.baseProgress + loopProgress) % 1.0;
      const pos = interpolatePosition(route, totalProgress);

      return {
        ...baseVeh,
        latitude: pos.lat,
        longitude: pos.lon,
        heading: pos.heading,
        speedKmh: Math.round(speedKmh),
        delaySeconds,
        predictedTerminalDelayMinutes: +(delaySeconds / 60).toFixed(1),
        status,
      };
    });

    // Dynamic alerts generation
    const dynamicAlerts: AlertItem[] = [];

    // Alert 1: Route м3 Bus Bunching (predictive from t=0, critical at t >= 75)
    if (!this.dismissedAlertIds.has("alert_1042")) {
      const baseAlert = MOCK_ALERTS.find((a) => a.id === "alert_1042") || MOCK_ALERTS[0];
      const isIncidentTime = t >= 75 && t < 340;
      
      let headwaySec = 480;
      let confidence = 82;
      let title = "Прогноз сбоя интервала: T+15 мин";
      let desc = "ML-модель прогнозирует сокращение интервала на узле м. Бауманская через 15 мин.";

      if (isHolding) {
        headwaySec = 460;
        confidence = 45;
        title = "Пачкование предотвращено (Holding применён)";
        desc = "Борт №1043 придержан на 2.5 мин. Интервал движения стабилизируется до 7.6 мин.";
      } else if (isIncidentTime) {
        headwaySec = Math.max(84, Math.round(480 - (t - 75) * 3.5));
        const headwayMin = +(headwaySec / 60).toFixed(1);
        confidence = 94;
        title = `Опережение на ${headwayMin} мин — риск пачкования`;
        desc = `Интервал между бортами сократился до ${headwayMin} мин (норма: 8.0 мин).`;
      } else {
        // Early predictive warning phase (0..75s)
        headwaySec = Math.max(240, Math.round(480 - t * 2.8));
        const headwayMin = +(headwaySec / 60).toFixed(1);
        confidence = Math.min(92, Math.round(78 + t * 0.2));
        title = `Риск пачкования T+15м: тренд к сокращению до ${headwayMin}м`;
        desc = `Замедление борта №1042 на Бакунинской ведёт к схлопыванию интервала с №1043.`;
      }

      dynamicAlerts.push({
        ...baseAlert,
        confidence,
        metrics: {
          headway_collapse_sec: headwaySec,
        },
        title,
        description: desc,
        recommendation: {
          ...baseAlert.recommendation,
          applied: isHolding,
          action: this.appliedScenarioId
            ? `${this.appliedScenarioId.toUpperCase()}_APPLIED`
            : isHolding
            ? "HOLDING_APPLIED"
            : undefined,
        },
      });
    }

    // Alert 2: Route m7 Congestion
    if (!this.dismissedAlertIds.has("alert_2198")) {
      const alertM7 = MOCK_ALERTS.find((a) => a.id === "alert_2198");
      if (alertM7) dynamicAlerts.push(alertM7);
    }

    // Alert 3: Route t88 Headway Compression
    if (!this.dismissedAlertIds.has("alert_0814")) {
      const alertT88 = MOCK_ALERTS.find((a) => a.id === "alert_0814");
      if (alertT88) dynamicAlerts.push(alertT88);
    }

    // Dynamic metrics
    const activeIncidents = dynamicAlerts.filter((a) => !a.recommendation?.applied).length;
    const preventedCount = MOCK_SYSTEM_METRICS.preventedIncidentsCount + (isHolding ? 1 : 0);
    const punctuality = isHolding ? 97.4 : activeIncidents > 0 ? 94.2 : 96.8;

    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    return {
      simTime: t,
      timeFormatted,
      isPlaying: this.isPlaying,
      speed: this.speed,
      isHoldingApplied: this.isHoldingApplied,
      holdingRemainingSec: this.holdingRemainingSec,
      appliedScenarioId: this.appliedScenarioId,
      vehicles: updatedVehicles,
      alerts: dynamicAlerts,
      metrics: {
        ...MOCK_SYSTEM_METRICS,
        activeIncidentsCount: activeIncidents,
        preventedIncidentsCount: preventedCount,
        punctualityRate: punctuality,
        vehiclesOnLine: updatedVehicles.length,
      },
    };
  }
}

// Global singleton instance for easy lifecycle access
export const demoEngine = new GPSDemoEngine();
