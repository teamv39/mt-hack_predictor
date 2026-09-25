import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  MOCK_SYSTEM_METRICS,
  MOCK_ROUTE_DATA,
  MOCK_VEHICLES,
  MOCK_ALERTS,
  MOCK_CAMERA,
  Vehicle,
  AlertItem,
  RouteData,
} from "../mock/telemetry";

const API_BASE = "http://localhost:8080/api/v1";

export interface ToastMessage {
  id: string;
  type: "success" | "warning" | "info" | "error";
  title: string;
  description: string;
  timestamp: string;
}

function mapBackendVehicle(bv: any, prevVeh?: Vehicle): Vehicle {
  const normalizedId = bv.id?.startsWith("P") ? bv.id : `P${bv.id}`;
  const isDelayed = bv.status === "DELAYED" || (bv.delay_seconds && bv.delay_seconds > 180);
  const isBunching = bv.status === "BUNCHING_RISK";
  const status: "BUNCHING_RISK" | "NORMAL" | "DELAYED" = isBunching ? "BUNCHING_RISK" : isDelayed ? "DELAYED" : "NORMAL";

  return {
    id: normalizedId,
    badgeLabel: `${(bv.id || "").replace(/^P/, "")} · ${bv.route_id || "м3"}`,
    plateNumber: prevVeh?.plateNumber || (String(bv.id).includes("1042") ? "Е 742 КХ 799" : "М 104 ВВ 777"),
    model: prevVeh?.model || "ЛиАЗ-6213.65 (Гармошка)",
    routeId: bv.route_id || "m3",
    routeName: "Маршрут м3",
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
  return {
    id: ba.id || "alert_1042",
    vehicleId: ba.vehicle_id ? (ba.vehicle_id.startsWith("P") ? ba.vehicle_id : `P${ba.vehicle_id}`) : "P1042",
    followingVehicleId: "P1043",
    routeNumberBadge: "м3",
    routeId: ba.route_id || "m3",
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
  };
}

export function useTelemetry() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(MOCK_VEHICLES);
  const [alerts, setAlerts] = useState<AlertItem[]>(MOCK_ALERTS);
  const [selectedAlertId, setSelectedAlertId] = useState<string>("alert_1042");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("P1042");
  const [timeStep, setTimeStep] = useState<string>("+30 мин");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"all" | "critical" | "bunching">("all");
  const [activeTab, setActiveTab] = useState<string>("Ситуационный зал");
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [metrics, setMetrics] = useState(MOCK_SYSTEM_METRICS);

  const prevVehiclesRef = useRef<Vehicle[]>(vehicles);
  prevVehiclesRef.current = vehicles;

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

  const selectedAlert = useMemo(() => {
    return alerts.find((a) => a.id === selectedAlertId) || alerts[0] || null;
  }, [alerts, selectedAlertId]);

  const selectedVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0] || null;
  }, [vehicles, selectedVehicleId]);

  const handleSelectAlert = useCallback((alertItem: AlertItem) => {
    setSelectedAlertId(alertItem.id);
    if (alertItem.vehicleId) {
      setSelectedVehicleId(alertItem.vehicleId);
    }
    setFlyToTarget({
      lat: alertItem.latitude,
      lon: alertItem.longitude,
      zoom: 14,
    });
  }, []);

  const handleSelectVehicle = useCallback((vehId: string) => {
    setSelectedVehicleId(vehId);
    const linkedAlert = alerts.find((a) => a.vehicleId === vehId);
    if (linkedAlert) {
      setSelectedAlertId(linkedAlert.id);
    }
    const veh = vehicles.find((v) => v.id === vehId);
    if (veh) {
      setFlyToTarget({ lat: veh.latitude, lon: veh.longitude, zoom: 14 });
    }
  }, [alerts, vehicles]);

  // Live Go Backend Synchronization (WebSocket + Polling fallback)
  useEffect(() => {
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

        if (Array.isArray(vehRes) && vehRes.length > 0) {
          setVehicles((prev) => {
            const mapped = vehRes.map((bv: any) => {
              const existing = prev.find((p) => p.id === (bv.id.startsWith("P") ? bv.id : `P${bv.id}`));
              return mapBackendVehicle(bv, existing);
            });
            return mapped;
          });
        }

        if (Array.isArray(alertRes) && alertRes.length > 0) {
          const mappedAlerts = alertRes.map(mapBackendAlert);
          setAlerts(mappedAlerts);
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
      const host = window.location.hostname || "localhost";
      const wsUrl = `ws://${host}:8080/ws`;
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
                setVehicles((prev) =>
                  data.vehicles.map((bv: any) => {
                    const existing = prev.find((p) => p.id === (bv.id.startsWith("P") ? bv.id : `P${bv.id}`));
                    return mapBackendVehicle(bv, existing);
                  })
                );
              }
              if (data.alert) {
                const newAlert = mapBackendAlert(data.alert);
                setAlerts((prev) => {
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
      if (ws) ws.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  const applyHolding = useCallback(async (alertId: string) => {
    try {
      await fetch(`${API_BASE}/recommendations/${alertId}/apply`, {
        method: "POST",
      });
    } catch {
      // Backend standalone fallback
    }

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

    setVehicles((prevVehs) =>
      prevVehs.map((veh) => {
        if (veh.id === "P1042" || veh.id === "P1043") {
          return {
            ...veh,
            status: "NORMAL",
            delaySeconds: 150,
            predictedTerminalDelayMinutes: 2.5,
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

    addToast({
      type: "success",
      title: "Команда Holding успешно передана в АСУ-РДС",
      description: "Борт №1043 придержан на 2.5 мин на остановке «Метро Бауманская». Интервал восстановится до 7.5 мин.",
    });
  }, [addToast]);

  const controlSimulation = useCallback(
    async (action: "play" | "pause" | "speed" | "step" | "reset", value?: number | string) => {
      if (action === "play") setIsSimPlaying(true);
      if (action === "pause") setIsSimPlaying(false);
      if (action === "speed" && typeof value === "number") setSimSpeed(value);
      if (action === "step" && typeof value === "string") setTimeStep(value);

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

      addToast({
        type: "info",
        title: "Параметры симуляции",
        description: action === "step" ? `Срез времени: ${value}` : `Режим: ${action} ${value || ""}`,
      });
    },
    [addToast]
  );

  return {
    vehicles,
    alerts,
    selectedAlert,
    selectedVehicle,
    selectedAlertId,
    selectedVehicleId,
    metrics,
    route: MOCK_ROUTE_DATA as RouteData,
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
    handleSelectAlert,
    handleSelectVehicle,
    applyHolding,
    controlSimulation,
  };
}
