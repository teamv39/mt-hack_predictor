import { useState, useEffect, useCallback, useMemo } from "react";
import {
  MOCK_SYSTEM_METRICS,
  MOCK_ROUTE_M3,
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

export function useTelemetry() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(MOCK_VEHICLES);
  const [alerts, setAlerts] = useState<AlertItem[]>(MOCK_ALERTS);
  const [selectedAlertId, setSelectedAlertId] = useState<string>("alert_m3_001");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("P1042");
  const [timeStep, setTimeStep] = useState<string>("+30 мин");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"all" | "critical" | "bunching">("all");
  const [activeTab, setActiveTab] = useState<string>("Ситуационный зал");
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [metrics, setMetrics] = useState({
    vehiclesOnLine: MOCK_SYSTEM_METRICS.vehiclesOnLine,
    punctualityRate: MOCK_SYSTEM_METRICS.punctualityRate,
    activeIncidentsCount: MOCK_SYSTEM_METRICS.activeIncidentsCount,
    preventedIncidentsCount: MOCK_SYSTEM_METRICS.preventedIncidentsCount,
    modelVersion: MOCK_SYSTEM_METRICS.modelVersion,
    engineLatencyMs: MOCK_SYSTEM_METRICS.engineLatencyMs,
  });

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

  // Currently selected alert & vehicle
  const selectedAlert = useMemo(() => {
    return alerts.find((a) => a.id === selectedAlertId) || alerts[0] || null;
  }, [alerts, selectedAlertId]);

  const selectedVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0] || null;
  }, [vehicles, selectedVehicleId]);

  // Handle selecting an alert
  const handleSelectAlert = useCallback((alertItem: AlertItem) => {
    setSelectedAlertId(alertItem.id);
    if (alertItem.vehicleId) {
      setSelectedVehicleId(alertItem.vehicleId);
    }
    setFlyToTarget({
      lat: alertItem.latitude,
      lon: alertItem.longitude,
      zoom: 15,
    });
  }, []);

  // Handle selecting a vehicle directly
  const handleSelectVehicle = useCallback((vehId: string) => {
    setSelectedVehicleId(vehId);
    const linkedAlert = alerts.find((a) => a.vehicleId === vehId);
    if (linkedAlert) {
      setSelectedAlertId(linkedAlert.id);
    }
    const veh = vehicles.find((v) => v.id === vehId);
    if (veh) {
      setFlyToTarget({ lat: veh.latitude, lon: veh.longitude, zoom: 15 });
    }
  }, [alerts, vehicles]);

  // Apply Holding DSS Recommendation
  const applyHolding = useCallback(async (alertId: string) => {
    // Try sending to Go backend if available
    try {
      await fetch(`${API_BASE}/recommendations/${alertId}/apply`, {
        method: "POST",
      });
    } catch {
      // Backend not running in standalone mode, handle locally
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

    // Update vehicle status
    setVehicles((prevVehs) =>
      prevVehs.map((veh) => {
        if (veh.id === "P1042") {
          return {
            ...veh,
            status: "NORMAL",
            delaySeconds: 150,
            headwaySeconds: 450,
            predictedTerminalDelayMinutes: 2.5,
          };
        }
        return veh;
      })
    );

    // Update metrics
    setMetrics((prev) => ({
      ...prev,
      preventedIncidentsCount: prev.preventedIncidentsCount + 1,
      activeIncidentsCount: Math.max(0, prev.activeIncidentsCount - 1),
      punctualityRate: 96.4,
    }));

    addToast({
      type: "success",
      title: "Рекомендация Holding успешно передана в АСУ-РДС",
      description: "Команда удержания борта №1043 на 2.5 мин на остановке «Метро Бауманская» подтверждена. Интервал стабилизирован.",
    });
  }, [addToast]);

  // Control simulation time and speed
  const controlSimulation = useCallback(
    (action: "play" | "pause" | "speed" | "step", value?: number | string) => {
      if (action === "play") setIsSimPlaying(true);
      if (action === "pause") setIsSimPlaying(false);
      if (action === "speed" && typeof value === "number") setSimSpeed(value);
      if (action === "step" && typeof value === "string") setTimeStep(value);

      addToast({
        type: "info",
        title: "Параметры симуляции обновлены",
        description: action === "step" ? `Срез прогноза: ${value}` : `Режим: ${action} ${value || ""}`,
      });
    },
    [addToast]
  );

  // Subtle live telemetry pulse animation for demo
  useEffect(() => {
    if (!isSimPlaying) return;

    const interval = setInterval(() => {
      setVehicles((prev) =>
        prev.map((v) => {
          // Micro-movement along coordinates
          const jitterLat = (Math.random() - 0.48) * 0.00015 * simSpeed;
          const jitterLon = (Math.random() - 0.48) * 0.0002 * simSpeed;
          return {
            ...v,
            latitude: v.latitude + jitterLat,
            longitude: v.longitude + jitterLon,
            speedKmh: Math.max(8, Math.min(48, Math.round(v.speedKmh + (Math.random() - 0.5) * 2))),
          };
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [isSimPlaying, simSpeed]);

  return {
    vehicles,
    alerts,
    selectedAlert,
    selectedVehicle,
    selectedAlertId,
    selectedVehicleId,
    metrics,
    route: MOCK_ROUTE_M3 as RouteData,
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
