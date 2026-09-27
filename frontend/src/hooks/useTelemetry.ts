import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  MOCK_SYSTEM_METRICS,
  MOCK_ROUTE_DATA,
  MOCK_VEHICLES,
  MOCK_ALERTS,
  MOCK_CAMERA,
  MOCK_ALL_ROUTES,
  Vehicle,
  AlertItem,
  RouteData,
} from "../mock/telemetry";
import { demoEngine } from "../simulation/gpsDemoEngine";
import { loadPreferences, savePreferences } from "../utils/storage";

const API_BASE = "/api/v1";
const DATASET_TRACK_LIMIT = 12;
const DATASET_ROUTE_COLORS = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100",
  "#e87ba4", "#008300", "#4a3aa7", "#e34948",
];
const OTHER_TRACK_COLOR = "#71717a";

export type DataMode = "mock" | "dataset" | "live";

export interface GPSTrackPoint {
  event_time: string;
  lon: number;
  lat: number;
  speed: number;
  heading: number;
}

export interface GPSTrack {
  tr_id: number;
  points: GPSTrackPoint[];
  bounds: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
  };
}

interface TrackReference {
  tr_id: number;
  points?: GPSTrackPoint[];
  bounds?: GPSTrack["bounds"];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseTrackPoint(value: unknown): GPSTrackPoint | null {
  if (!isRecord(value)) return null;
  const lon = Number(value.lon);
  const lat = Number(value.lat);
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  return {
    event_time: typeof value.event_time === "string" ? value.event_time : "",
    lon,
    lat,
    speed: Number.isFinite(Number(value.speed)) ? Number(value.speed) : 0,
    heading: Number.isFinite(Number(value.heading)) ? Number(value.heading) : 0,
  };
}

function parseBounds(value: unknown): GPSTrack["bounds"] | undefined {
  if (!isRecord(value)) return undefined;
  const bounds = {
    min_lat: Number(value.min_lat), max_lat: Number(value.max_lat),
    min_lon: Number(value.min_lon), max_lon: Number(value.max_lon),
  };
  return Object.values(bounds).every(Number.isFinite) ? bounds : undefined;
}

function parseTrackReference(value: unknown): TrackReference | null {
  if (!isRecord(value)) return null;
  const trId = Number(value.tr_id);
  if (!Number.isSafeInteger(trId)) return null;
  const points = Array.isArray(value.points)
    ? value.points.map(parseTrackPoint).filter((point): point is GPSTrackPoint => point !== null)
    : undefined;
  const bounds = parseBounds(value.bounds);
  return { tr_id: trId, ...(points ? { points } : {}), ...(bounds ? { bounds } : {}) };
}

function getTrackReferences(payload: unknown): TrackReference[] {
  const items = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.tracks) ? payload.tracks
      : isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
  return items.map(parseTrackReference).filter((track): track is TrackReference => track !== null);
}

function toGPSTrack(track: TrackReference): GPSTrack {
  const points = track.points || [];
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  return {
    tr_id: track.tr_id,
    points,
    bounds: track.bounds || {
      min_lat: Math.min(...lats), max_lat: Math.max(...lats),
      min_lon: Math.min(...lons), max_lon: Math.max(...lons),
    },
  };
}

export async function loadTracksFromDataset(): Promise<GPSTrack[]> {
  const listResponse = await fetch(`${API_BASE}/tracks?limit=${DATASET_TRACK_LIMIT}`);
  if (!listResponse.ok) throw new Error(`Track list request failed: ${listResponse.status}`);
  const references = getTrackReferences(await listResponse.json()).slice(0, DATASET_TRACK_LIMIT);
  if (references.length === 0) throw new Error("Track list is empty or invalid");

  const tracks = await Promise.all(references.map(async (reference) => {
    if (reference.points && reference.points.length > 0) return toGPSTrack(reference);
    const response = await fetch(`${API_BASE}/tracks/${reference.tr_id}`);
    if (!response.ok) throw new Error(`Track ${reference.tr_id} request failed: ${response.status}`);
    const payload: unknown = await response.json();
    const details = parseTrackReference(payload) || getTrackReferences(payload)[0];
    if (!details || !details.points?.length) throw new Error(`Track ${reference.tr_id} has no GPS points`);
    return toGPSTrack({ ...reference, ...details });
  }));
  return tracks.filter((track) => track.points.length > 0);
}

export function isSVOSpoofingPoint(lat: number, lon: number): boolean {
  return lat >= 55.95 && lat <= 56.02 && lon >= 37.38 && lon <= 37.46;
}

export function mapTrackToVehicle(track: GPSTrack): Vehicle {
  const hasNonSVO = track.points.some((p) => !isSVOSpoofingPoint(p.lat, p.lon));
  const pointsPool = hasNonSVO
    ? track.points.filter((p) => !isSVOSpoofingPoint(p.lat, p.lon))
    : track.points;

  const latestPoint = pointsPool.reduce((latest, point) => {
    if (!latest) return point;
    const latestTime = Date.parse(latest.event_time);
    const pointTime = Date.parse(point.event_time);
    return Number.isNaN(latestTime) || Number.isNaN(pointTime) || pointTime > latestTime ? point : latest;
  }, pointsPool[0] || track.points[0]);
  const vehicleId = `P${track.tr_id}`;
  return {
    id: vehicleId,
    badgeLabel: `${track.tr_id} · GPS`,
    plateNumber: `GPS ${track.tr_id}`,
    model: "Транспортное средство",
    routeId: String(track.tr_id),
    routeName: `GPS-трек ${track.tr_id}`,
    status: "NORMAL",
    delaySeconds: 0,
    predictedTerminalDelayMinutes: 0,
    speedKmh: Math.max(0, latestPoint.speed),
    latitude: latestPoint.lat,
    longitude: latestPoint.lon,
    heading: ((latestPoint.heading % 360) + 360) % 360,
    currentStop: "В пути",
    nextStop: "GPS-точка",
  };
}

function mapTrackToRoute(track: GPSTrack, index: number): RouteData {
  const hasNonSVO = track.points.some((p) => !isSVOSpoofingPoint(p.lat, p.lon));
  const cleanPoints = hasNonSVO
    ? track.points.filter((p) => !isSVOSpoofingPoint(p.lat, p.lon))
    : track.points;

  const points = [...cleanPoints].sort((left, right) => {
    const leftTime = Date.parse(left.event_time);
    const rightTime = Date.parse(right.event_time);
    return Number.isNaN(leftTime) || Number.isNaN(rightTime) ? 0 : leftTime - rightTime;
  });
  return {
    routeId: String(track.tr_id),
    name: `GPS-трек ${track.tr_id}`,
    color: index < DATASET_ROUTE_COLORS.length ? DATASET_ROUTE_COLORS[index] : OTHER_TRACK_COLOR,
    routeGeometry: points.map((point) => [point.lon, point.lat]),
    congestionSegment: [],
    stops: [],
  };
}

export interface ToastMessage {
  id: string;
  type: "success" | "warning" | "info" | "error";
  title: string;
  description: string;
  timestamp: string;
}

export function normalizeRouteId(id?: string): string {
  if (!id) return "м3";
  let s = id.trim();
  if (/^m/i.test(s)) {
    s = "м" + s.slice(1);
  } else if (/^t/i.test(s)) {
    s = "т" + s.slice(1);
  }
  return s;
}

function mapBackendVehicle(bv: any, prevVeh?: Vehicle): Vehicle {
  const normalizedId = bv.id?.startsWith("P") ? bv.id : `P${bv.id}`;
  const isDelayed = bv.status === "DELAYED" || (bv.delay_seconds && bv.delay_seconds > 180);
  const isBunching = bv.status === "BUNCHING_RISK";
  const status: "BUNCHING_RISK" | "NORMAL" | "DELAYED" = isBunching ? "BUNCHING_RISK" : isDelayed ? "DELAYED" : "NORMAL";
  const routeId = normalizeRouteId(bv.route_id || prevVeh?.routeId || "м3");

  return {
    id: normalizedId,
    badgeLabel: `${(bv.id || "").replace(/^P/, "")} · ${routeId}`,
    plateNumber: prevVeh?.plateNumber || (String(bv.id).includes("1042") ? "Е 742 КХ 799" : "М 104 ВВ 777"),
    model: prevVeh?.model || "ЛиАЗ-6213.65 (Гармошка)",
    routeId,
    routeName: prevVeh?.routeName || `Маршрут ${routeId}`,
    status,
    delaySeconds: Math.round(bv.delay_seconds || 0),
    predictedTerminalDelayMinutes: +(bv.delay_seconds ? (bv.delay_seconds / 60).toFixed(1) : 0),
    speedKmh: Math.round((bv.speed_kmh || 0) * 10) / 10,
    latitude: bv.latitude,
    longitude: bv.longitude,
    heading: bv.bearing || 0,
    currentStop: bv.next_stop_name || prevVeh?.currentStop || "В пути",
    nextStop: bv.next_stop_name || prevVeh?.nextStop || "м. Бауманская",
  };
}

function mapBackendAlert(ba: any): AlertItem {
  const normRouteId = normalizeRouteId(ba.route_id || "м3");
  return {
    id: ba.id || "alert_1042",
    vehicleId: ba.vehicle_id ? (ba.vehicle_id.startsWith("P") ? ba.vehicle_id : `P${ba.vehicle_id}`) : "P1042",
    followingVehicleId: "P1043",
    routeNumberBadge: normRouteId,
    routeId: normRouteId,
    urgencyBadge: "T+15 мин",
    urgencyMinutes: 15,
    tag: ba.type === "BUS_BUNCHING" ? "Схлопывание интервала" : "Задержка рейса",
    tagType: "bunching",
    title: ba.message || "Риск пачкования автобусов",
    delayLabel: "+2.5 мин",
    description: ba.message || "Интервал между бортами сократился ниже критического порога.",
    confidence: Math.round((ba.probability || 0.88) * 100),
    locationName: ba.recommendation?.hold_stop_name || "м. Бауманская",
    latitude: 55.7724,
    longitude: 37.6791,
    category: "critical",
    shapFactors: (ba.factors && ba.factors.length > 0)
      ? ba.factors.map((f: any, idx: number) => ({
          title: f.title || f.feature,
          delayMinutes: +(f.impact_score ? (f.impact_score / 60).toFixed(1) : 1.2),
          percent: Math.round(f.weight || (idx === 0 ? 60 : 40)),
          color: idx === 0 ? "#ef4444" : idx === 1 ? "#f59e0b" : "#3b82f6",
        }))
      : [
          { title: "Затор на ул. Бауманская", delayMinutes: 2.3, percent: 55, color: "#ef4444" },
          { title: "Задержка посадки (дождь)", delayMinutes: 1.1, percent: 27, color: "#f59e0b" },
          { title: "Светофорный цикл ТТК", delayMinutes: 0.8, percent: 18, color: "#3b82f6" },
        ],
    delayChartData: [
      { stop: "Семеновская", plan: 0, withoutAction: 0, withHolding: 0 },
      { stop: "Электрозаводская", plan: 4, withoutAction: 4.2, withHolding: 4.2 },
      { stop: "Бакунинская", plan: 8, withoutAction: 9.5, withHolding: 8.5 },
      { stop: "Бауманская", plan: 12, withoutAction: 16.5, withHolding: 12.5 },
      { stop: "Красные Ворота", plan: 17, withoutAction: 22.0, withHolding: 17.5 },
    ],
    recommendation: {
      id: ba.id || "rec_1042",
      targetVehicleId: ba.recommendation?.target_vehicle_id ? (ba.recommendation.target_vehicle_id.startsWith("P") ? ba.recommendation.target_vehicle_id : `P${ba.recommendation.target_vehicle_id}`) : "P1043",
      durationSeconds: ba.recommendation?.duration_seconds || 150,
      durationMinutes: +(ba.recommendation?.duration_seconds ? (ba.recommendation.duration_seconds / 60).toFixed(1) : 2.5),
      stopName: ba.recommendation?.hold_stop_name || "м. Бауманская",
      effectPercent: 85,
      text: ba.recommendation?.predicted_impact || "Придержать борт №1043 на 2.5 мин на остановке «м. Бауманская»",
      infoText: "Выравнивает интервал движения с 1.2 мин до 7.5 мин по формуле Велдинга.",
      applied: ba.recommendation?.applied || false,
    },
    metrics: {
      headway_collapse_sec: ba.headway_seconds || ba.metrics?.headway_collapse_sec || 96,
    },
  };
}

export function useTelemetry() {
  const initialPrefs = useMemo(() => loadPreferences(), []);
  const dismissedAlertIds = useRef(new Set(initialPrefs.dismissedAlerts));

  const [appliedHoldingIds, setAppliedHoldingIds] = useState<string[]>(initialPrefs.appliedHoldingIds || []);
  const [, setAppliedScenarios] = useState<Record<string, string>>(initialPrefs.appliedScenarios || {});
  const [dataMode, setDataModeState] = useState<DataMode>("mock");
  const [datasetRoutes, setDatasetRoutes] = useState<RouteData[]>([]);
  const [datasetLoadError, setDatasetLoadError] = useState<string | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const state = demoEngine.getState();
    return state.vehicles.length > 0 ? state.vehicles : MOCK_VEHICLES;
  });

  const [alerts, setAlerts] = useState<AlertItem[]>(() => {
    return MOCK_ALERTS.filter((alt) => !dismissedAlertIds.current.has(alt.id)).map((alt) => {
      const isHolding = initialPrefs.appliedHoldingIds?.includes(alt.id);
      const scenario = initialPrefs.appliedScenarios?.[alt.id];
      if (isHolding || scenario) {
        return {
          ...alt,
          recommendation: {
            ...alt.recommendation,
            applied: true,
            action: scenario ? `${scenario.toUpperCase()}_APPLIED` : "HOLDING_APPLIED",
          },
        };
      }
      return alt;
    });
  });

  const [selectedAlertId, setSelectedAlertId] = useState<string>(() =>
    alerts.some((alert) => alert.id === initialPrefs.selectedAlertId)
      ? initialPrefs.selectedAlertId
      : alerts[0]?.id || "alert_1042"
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(initialPrefs.selectedVehicleId || "P1042");
  const [timeStep, setTimeStepState] = useState<string>(initialPrefs.timeStep || "Сейчас");
  const [searchQuery, setSearchQueryState] = useState<string>(initialPrefs.searchQuery || "");
  const [activeFilter, setActiveFilterState] = useState<"all" | "critical" | "bunching">(initialPrefs.activeFilter || "all");
  const [activeTab, setActiveTabState] = useState<string>(initialPrefs.activeTab || "hall");
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeedState] = useState<number>(initialPrefs.simSpeed || 1.0);
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [metrics, setMetrics] = useState(() => MOCK_SYSTEM_METRICS);

  const setDataMode = useCallback((mode: DataMode) => {
    setDataModeState(mode);
    setDatasetLoadError(null);
    setFlyToTarget(null);
    setTimeStepState("Сейчас");
    if (mode === "mock") {
      setDatasetRoutes([]);
      const state = demoEngine.getState();
      setVehicles(state.vehicles);
      setAlerts(state.alerts);
      setSelectedAlertId(state.alerts[0]?.id || "alert_1042");
      setSelectedVehicleId("P1042");
    } else if (mode === "dataset") {
      setVehicles([]);
      setAlerts(MOCK_ALERTS.filter((alert) => !dismissedAlertIds.current.has(alert.id)));
    } else {
      setDatasetRoutes([]);
      setVehicles(MOCK_VEHICLES);
      setAlerts(MOCK_ALERTS.filter((alert) => !dismissedAlertIds.current.has(alert.id)));
    }
  }, []);

  // Continuous GPS Demo Loop (Mock/Demo Mode)
  useEffect(() => {
    if (dataMode !== "mock") {
      demoEngine.stop();
      return;
    }

    demoEngine.start();
    const unsubscribe = demoEngine.subscribe((simState) => {
      setVehicles(simState.vehicles);
      setAlerts(simState.alerts);
      setMetrics(simState.metrics);
      setSelectedAlertId((prev) => {
        if (prev && simState.alerts.some((a) => a.id === prev)) return prev;
        return simState.alerts[0]?.id || "";
      });
    });

    return () => {
      unsubscribe();
      demoEngine.stop();
    };
  }, [dataMode]);

  useEffect(() => {
    if (dataMode !== "dataset") return;
    let cancelled = false;
    setDatasetRoutes([]);
    setVehicles([]);
    setAlerts(MOCK_ALERTS.filter((alert) => !dismissedAlertIds.current.has(alert.id)));
    loadTracksFromDataset()
      .then((tracks) => {
        if (cancelled) return;
        if (!tracks.length) throw new Error("No GPS tracks with valid points");
        setDatasetRoutes(tracks.map(mapTrackToRoute));
        setVehicles(tracks.map(mapTrackToVehicle));
        setSelectedVehicleId(`P${tracks[0].tr_id}`);
        setDatasetLoadError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setDatasetLoadError(error instanceof Error ? error.message : "Dataset unavailable");
        setDatasetRoutes([]);
        setVehicles(MOCK_VEHICLES);
        setAlerts(MOCK_ALERTS.filter((alert) => !dismissedAlertIds.current.has(alert.id)));
      });
    return () => { cancelled = true; };
  }, [dataMode]);

  const setActiveFilter = useCallback((filter: "all" | "critical" | "bunching") => {
    setActiveFilterState(filter);
    savePreferences({ activeFilter: filter });
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    savePreferences({ activeTab: tab as any });
  }, []);

  const setTimeStep = useCallback((step: string) => {
    setTimeStepState(step);
    savePreferences({ timeStep: step });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    savePreferences({ searchQuery: query });
  }, []);

  const addToast = useCallback((toast: Omit<ToastMessage, "id" | "timestamp">) => {
    const newToast: ToastMessage = {
      ...toast,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    if (dismissedAlertIds.current.has(alertId)) return;

    dismissedAlertIds.current.add(alertId);
    savePreferences({ dismissedAlerts: [...dismissedAlertIds.current] });
    demoEngine.dismissAlert(alertId);
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));

    if (selectedAlertId === alertId) {
      const nextAlert = alerts.find((alert) => alert.id !== alertId);
      setSelectedAlertId(nextAlert?.id || "");
      savePreferences({ selectedAlertId: nextAlert?.id || "" });
    }

    addToast({ type: "info", title: "Алерт закрыт", description: "" });
  }, [addToast, alerts, selectedAlertId]);

  const selectedAlert = useMemo(() => {
    return alerts.find((a) => a.id === selectedAlertId) || alerts[0] || null;
  }, [alerts, selectedAlertId]);

  const selectedVehicle = useMemo(() => {
    const normalize = (id?: string) => (id ? id.replace(/^P/, "").trim() : "");
    const targetVehId = selectedVehicleId || selectedAlert?.vehicleId;
    const cleanTargetId = normalize(targetVehId);

    // 1. Direct or normalized match in vehicles list
    const found = vehicles.find(
      (v) => v.id === targetVehId || normalize(v.id) === cleanTargetId
    );
    if (found) return found;

    // 2. Only live mode may synthesize a vehicle from an alert.
    if (dataMode === "live" && selectedAlert?.vehicleId) {
      const alertVehClean = normalize(selectedAlert.vehicleId);
      const byAlert = vehicles.find((v) => normalize(v.id) === alertVehClean);
      if (byAlert) return byAlert;

      // Synthesize vehicle representation from selectedAlert if not in list
      const cleanNum = selectedAlert.vehicleId.replace(/\D/g, "") || "0814";
      return {
        id: selectedAlert.vehicleId.startsWith("P") ? selectedAlert.vehicleId : `P${selectedAlert.vehicleId}`,
        badgeLabel: `${selectedAlert.vehicleId.replace(/^P/, "")} · ${selectedAlert.routeNumberBadge}`,
        plateNumber: `А ${cleanNum.slice(-3)} ТР 799`,
        model: "ЛиАЗ-6274 (Электробус)",
        routeId: selectedAlert.routeId || "т88",
        routeName: `Маршрут ${selectedAlert.routeNumberBadge}`,
        status: selectedAlert.category === "critical" ? ("DELAYED" as const) : ("BUNCHING_RISK" as const),
        delaySeconds: (selectedAlert.urgencyMinutes || 6) * 60,
        predictedTerminalDelayMinutes: selectedAlert.urgencyMinutes || 6,
        speedKmh: 19,
        latitude: selectedAlert.latitude,
        longitude: selectedAlert.longitude,
        heading: 90,
        currentStop: selectedAlert.locationName.split("→")[0]?.trim() || selectedAlert.locationName,
        nextStop: selectedAlert.recommendation?.stopName?.replace(/[«»]/g, "") || selectedAlert.locationName,
      };
    }

    return vehicles[0] || null;
  }, [vehicles, selectedVehicleId, selectedAlert, dataMode]);

  const handleSelectAlert = useCallback((alertItem: AlertItem) => {
    setSelectedAlertId(alertItem.id);
    const newVehId = alertItem.vehicleId || selectedVehicleId;
    if (alertItem.vehicleId) {
      setSelectedVehicleId(alertItem.vehicleId);
    }
    savePreferences({ selectedAlertId: alertItem.id, selectedVehicleId: newVehId });
    setFlyToTarget({
      lat: alertItem.latitude,
      lon: alertItem.longitude,
      zoom: 14,
    });
  }, [selectedVehicleId]);

  const handleSelectVehicle = useCallback((vehId: string) => {
    setSelectedVehicleId(vehId);
    const cleanId = vehId.replace(/^P/, "");
    const linkedAlert = alerts.find(
      (a) => a.vehicleId === vehId || a.vehicleId.replace(/^P/, "") === cleanId
    );
    const newAlertId = linkedAlert ? linkedAlert.id : selectedAlertId;
    if (linkedAlert) {
      setSelectedAlertId(linkedAlert.id);
    }
    savePreferences({ selectedVehicleId: vehId, selectedAlertId: newAlertId });
    const veh = vehicles.find((v) => v.id === vehId || v.id.replace(/^P/, "") === cleanId);
    if (veh) {
      setFlyToTarget({ lat: veh.latitude, lon: veh.longitude, zoom: 14 });
    }
  }, [alerts, vehicles, selectedAlertId]);

  // Live Go Backend Synchronization (WebSocket + Polling fallback)
  useEffect(() => {
    if (dataMode !== "live") return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let isConnected = false;

    const syncFromREST = async () => {
      try {
        const [vehRes, alertRes, statRes] = await Promise.all([
          fetch(`${API_BASE}/vehicles`).then((r) => (r.ok ? r.json() : null)),
          fetch(`${API_BASE}/alerts`).then((r) => (r.ok ? r.json() : null)),
          fetch(`${API_BASE}/status`).then((r) => (r.ok ? r.json() : null)),
        ]);

        if (cancelled) return;
        if (Array.isArray(vehRes) && vehRes.length > 0) {
          setVehicles((prev) => {
            const mapped = vehRes.map((bv: any) => {
              const existing = prev.find((p) => p.id === (bv.id.startsWith("P") ? bv.id : `P${bv.id}`));
              return mapBackendVehicle(bv, existing);
            });
            const incomingIds = new Set(mapped.map((v) => v.id));
            const preserved = prev.filter((p) => !incomingIds.has(p.id));
            return [...mapped, ...preserved];
          });
        }

        if (Array.isArray(alertRes) && alertRes.length > 0) {
          const mappedAlerts = alertRes.map(mapBackendAlert).filter((alert) => !dismissedAlertIds.current.has(alert.id));
          setAlerts((prev) => {
            const incomingIds = new Set(mappedAlerts.map((a) => a.id));
            const preserved = prev.filter((p) => !incomingIds.has(p.id) && !dismissedAlertIds.current.has(p.id));
            return [...mappedAlerts, ...preserved];
          });
        }

        if (statRes) {
          setMetrics((prev) => ({
            ...prev,
            punctualityRate: statRes.punctuality_rate || prev.punctualityRate,
            activeIncidentsCount: statRes.active_alerts_count ?? prev.activeIncidentsCount,
            preventedIncidentsCount: statRes.prevented_incidents_count ?? prev.preventedIncidentsCount,
            engineLatencyMs: statRes.engine_latency_ms || prev.engineLatencyMs,
          }));
        }
      } catch {
        // Fallback silently if backend is offline
      }
    };

    const setupWebSocket = () => {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = window.location.host || "localhost:8080";
      const wsUrl = `${wsProtocol}//${wsHost}/ws`;
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          isConnected = true;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "TELEMETRY_UPDATE") {
              if (Array.isArray(data.vehicles) && data.vehicles.length > 0) {
                setVehicles((prev) => {
                  const mapped: Vehicle[] = data.vehicles.map((bv: any) => {
                    const existing = prev.find((p) => p.id === (bv.id.startsWith("P") ? bv.id : `P${bv.id}`));
                    return mapBackendVehicle(bv, existing);
                  });
                  const incomingIds = new Set(mapped.map((v: Vehicle) => v.id));
                  const preserved = prev.filter((p) => !incomingIds.has(p.id));
                  return [...mapped, ...preserved];
                });
              }
              if (data.alert) {
                const newAlert = mapBackendAlert(data.alert);
                setAlerts((prev) => {
                  if (dismissedAlertIds.current.has(newAlert.id)) return prev;
                  const exists = prev.some((a) => a.id === newAlert.id);
                  if (exists) {
                    return prev.map((a) => (a.id === newAlert.id ? newAlert : a));
                  }
                  return [newAlert, ...prev];
                });
              }
              if (data.status) {
                setMetrics((prev) => ({
                  ...prev,
                  punctualityRate: data.status.punctuality_rate || prev.punctualityRate,
                  activeIncidentsCount: data.status.active_alerts_count ?? prev.activeIncidentsCount,
                  preventedIncidentsCount: data.status.prevented_incidents_count ?? prev.preventedIncidentsCount,
                  engineLatencyMs: data.status.engine_latency_ms || prev.engineLatencyMs,
                }));
              }
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          isConnected = false;
        };

        ws.onerror = () => {
          isConnected = false;
        };
      } catch {
        isConnected = false;
      }
    };

    setupWebSocket();

    // Periodic REST fallback every 1200ms
    pollTimer = setInterval(() => {
      if (!isConnected || ws?.readyState !== WebSocket.OPEN) {
        syncFromREST();
      }
    }, 1200);

    return () => {
      cancelled = true;
      if (ws) ws.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [dataMode]);

  const applyHolding = useCallback(async (alertId: string) => {
    try {
      await fetch(`${API_BASE}/recommendations/${alertId}/apply`, {
        method: "POST",
      });
    } catch {
      // Backend standalone fallback
    }

    demoEngine.applyHolding(alertId);

    setAppliedHoldingIds((prev) => {
      const next = prev.includes(alertId) ? prev : [...prev, alertId];
      savePreferences({ appliedHoldingIds: next });
      return next;
    });

    setAlerts((prevAlerts) =>
      prevAlerts.map((alt) => {
        if (alt.id === alertId) {
          return {
            ...alt,
            recommendation: {
              ...alt.recommendation,
              applied: true,
            },
          };
        }
        return alt;
      })
    );

    const currentAlert = alerts.find((a) => a.id === alertId);
    const affectedVehIds = new Set<string>();
    if (currentAlert) {
      if (currentAlert.vehicleId) {
        affectedVehIds.add(currentAlert.vehicleId);
        affectedVehIds.add(currentAlert.vehicleId.replace(/^P/, ""));
      }
      if (currentAlert.followingVehicleId) {
        affectedVehIds.add(currentAlert.followingVehicleId);
        affectedVehIds.add(currentAlert.followingVehicleId.replace(/^P/, ""));
      }
      if (currentAlert.recommendation?.targetVehicleId) {
        const tid = currentAlert.recommendation.targetVehicleId.replace(/^[№P]/, "");
        affectedVehIds.add(tid);
        affectedVehIds.add(`P${tid}`);
      }
    }
    if (alertId.includes("1042")) {
      affectedVehIds.add("P1042");
      affectedVehIds.add("P1043");
    }

    setVehicles((prevVehs) =>
      prevVehs.map((veh) => {
        const cleanId = veh.id.replace(/^P/, "");
        if (affectedVehIds.has(veh.id) || affectedVehIds.has(cleanId)) {
          return {
            ...veh,
            status: "NORMAL",
            delaySeconds: 120,
            predictedTerminalDelayMinutes: 2,
          };
        }
        return veh;
      })
    );

    setMetrics((prev) => ({
      ...prev,
      preventedIncidentsCount: prev.preventedIncidentsCount + 1,
      activeIncidentsCount: Math.max(0, prev.activeIncidentsCount - 1),
      punctualityRate: 96.2,
    }));

    const targetVehName = currentAlert?.recommendation?.targetVehicleId || "№1043";
    const stopName = currentAlert?.recommendation?.stopName || "«Метро Бауманская»";
    const duration = currentAlert?.recommendation?.durationMinutes || 2.5;

    if (alertId === "alert_2198" || alertId.includes("2198")) {
      addToast({
        type: "success",
        title: "Зелёный коридор активирован в АСУ-ДД ЦОДД",
        description: "Адаптивная фаза на узле Таганская площадь включена. Борт №2198 ускорен, отставание ликвидировано.",
      });
    } else if (alertId === "alert_0814" || alertId.includes("0814")) {
      addToast({
        type: "success",
        title: "Команда Skip-Stop передана в АСУ-РДС",
        description: "Борт №0814 следует в экспресс-режиме без остановки «Садовая-Черногрязская». Такт стабилизирован.",
      });
    } else {
      addToast({
        type: "success",
        title: "Команда Holding успешно передана в АСУ-РДС",
        description: `Борт ${targetVehName} придержан на ${duration} мин на остановке ${stopName}. Интервал восстанавливается до планового.`,
      });
    }
  }, [addToast, alerts]);

  const applyScenario = useCallback(
    (scenarioId: string, _title?: string) => {
      demoEngine.applyScenario(scenarioId, selectedAlertId);

      setAppliedScenarios((prev) => {
        const next = { ...prev, [selectedAlertId]: scenarioId };
        savePreferences({ appliedScenarios: next });
        return next;
      });

      // 1. Mark alert as resolved / scenario applied
      setAlerts((prevAlerts) =>
        prevAlerts.map((alt) => {
          const isTarget =
            alt.id === selectedAlertId ||
            alt.vehicleId === selectedVehicleId ||
            alt.vehicleId.replace(/^P/, "") === selectedVehicleId.replace(/^P/, "");
          if (isTarget) {
            return {
              ...alt,
              recommendation: {
                ...alt.recommendation,
                applied: true,
                action: `${scenarioId.toUpperCase()}_APPLIED`,
              },
            };
          }
          return alt;
        })
      );

      // 2. Adjust vehicle status & inject reserve bus if scenario is depot_reserve
      const cleanVehId = selectedVehicleId.replace(/^P/, "");
      setVehicles((prevVehs) => {
        let updated = prevVehs.map((veh) => {
          if (veh.id === selectedVehicleId || veh.id.replace(/^P/, "") === cleanVehId) {
            return {
              ...veh,
              status: "NORMAL" as const,
              delaySeconds: scenarioId === "skip_stop" ? 90 : 60,
              predictedTerminalDelayMinutes: 1,
            };
          }
          return veh;
        });

        if (scenarioId === "depot_reserve" && !updated.some((v) => v.id === "P3105")) {
          const reserveVeh: Vehicle = {
            id: "P3105",
            badgeLabel: "3105 (Резерв)",
            plateNumber: "В 315 ЕХ 777",
            model: "ЛиАЗ-6274 (Электробус)",
            routeId: "м3",
            routeName: "м3 · Саратовская — Серебряный бор",
            status: "NORMAL",
            delaySeconds: 0,
            predictedTerminalDelayMinutes: 0,
            speedKmh: 32,
            latitude: 55.7824,
            longitude: 37.7056,
            heading: 235,
            currentStop: "Электрозаводский мост",
            nextStop: "ул. Бакунинская",
          };
          updated = [...updated, reserveVeh];
        }
        return updated;
      });

      // 3. Adjust metrics
      setMetrics((prev) => ({
        ...prev,
        preventedIncidentsCount: prev.preventedIncidentsCount + 1,
        activeIncidentsCount: Math.max(0, prev.activeIncidentsCount - 1),
        punctualityRate: 96.8,
      }));

      // 4. Provide scenario-specific dispatch toast
      if (scenarioId === "holding") {
        addToast({
          type: "success",
          title: "Команда Holding отправлена (Сценарий 1)",
          description: `Борт №${cleanVehId} скорректирован по такту. Расписание стабилизировано.`,
        });
      } else if (scenarioId === "skip_stop") {
        addToast({
          type: "warning",
          title: "Включен режим Skip-Stop (Сценарий 2)",
          description: `Борт №${cleanVehId} следует в экспресс-режиме без остановок. Нагоняет отставание.`,
        });
      } else if (scenarioId === "short_turning") {
        addToast({
          type: "info",
          title: "Оперативный разворот (Сценарий 3)",
          description: `Борт №${cleanVehId} направлен на разворотную петлю для ликвидации встречной дыры.`,
        });
      } else {
        addToast({
          type: "success",
          title: "Ввод резерва из парка (Сценарий 4)",
          description: `Резервный электробус №3105 вышел на маршрут м3 у м. Электрозаводская для закрытия интервала.`,
        });
      }
    },
    [addToast, selectedAlertId, selectedVehicleId]
  );

  const controlSimulation = useCallback(
    async (action: "play" | "pause" | "speed" | "step" | "reset", value?: number | string) => {
      if (action === "play") {
        demoEngine.play();
        setIsSimPlaying(true);
      }
      if (action === "pause") {
        demoEngine.pause();
        setIsSimPlaying(false);
      }
      if (action === "speed" && typeof value === "number") {
        demoEngine.setSpeed(value);
        setSimSpeedState(value);
        savePreferences({ simSpeed: value });
      }
      if (action === "step" && typeof value === "string") {
        if (value === "+15 мин" || value === "+15м (ML)") {
          demoEngine.seek(120);
        } else if (value === "+30 мин" || value === "+30м") {
          demoEngine.seek(240);
        } else if (value === "+45 мин" || value === "+45м") {
          demoEngine.seek(300);
        } else if (value === "Сейчас") {
          demoEngine.seek(0);
        }
        setTimeStepState(value);
        savePreferences({ timeStep: value });
      }
      if (action === "reset") {
        demoEngine.reset();
        setIsSimPlaying(true);
        setTimeStepState("Сейчас");
      }

      try {
        await fetch(`${API_BASE}/simulation/control`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            speed: typeof value === "number" ? value : undefined,
          }),
        });
      } catch {
        // Fallback
      }
    },
    []
  );

  const effectiveMetrics = useMemo(() => {
    if (dataMode === "dataset" && !datasetLoadError) {
      return {
        ...metrics,
        vehiclesOnLine: vehicles.length,
        activeIncidentsCount: 0,
        preventedIncidentsCount: 0,
      };
    }
    const unappliedAlerts = alerts.filter((a) => !a.recommendation?.applied).length;
    const appliedAlerts = alerts.filter((a) => a.recommendation?.applied).length;
    const dynamicPrevented = MOCK_SYSTEM_METRICS.preventedIncidentsCount + appliedAlerts;
    const dynamicPunctuality = appliedAlerts > 0 ? 96.8 : 94.8;

    return {
      ...metrics,
      activeIncidentsCount: unappliedAlerts,
      preventedIncidentsCount: dynamicPrevented,
      punctualityRate: dynamicPunctuality,
    };
  }, [alerts, metrics, dataMode, datasetLoadError, vehicles.length]);

  return {
    vehicles,
    alerts,
    appliedHoldingIds,
    selectedAlert,
    selectedVehicle,
    selectedAlertId,
    selectedVehicleId,
    metrics: effectiveMetrics,
    dataMode,
    setDataMode,
    datasetLoadError,
    route: dataMode === "dataset" ? (datasetRoutes[0] || (datasetLoadError ? (MOCK_ROUTE_DATA as RouteData) : null)) : (MOCK_ROUTE_DATA as RouteData),
    allRoutes: dataMode === "dataset" ? (datasetRoutes.length > 0 ? datasetRoutes : (datasetLoadError ? (MOCK_ALL_ROUTES as RouteData[]) : [])) : (MOCK_ALL_ROUTES as RouteData[]),
    camera: MOCK_CAMERA,
    timeStep,
    setTimeStep,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    activeTab,
    setActiveTab,
    isSimPlaying,
    simSpeed,
    flyToTarget,
    toasts,
    addToast,
    removeToast,
    dismissAlert,
    handleSelectAlert,
    handleSelectVehicle,
    applyHolding,
    applyScenario,
    controlSimulation,
  };
}
