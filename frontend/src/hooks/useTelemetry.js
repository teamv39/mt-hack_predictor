import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = "http://localhost:8080/api/v1";
const WS_URL = "ws://localhost:8080/ws";

export function useTelemetry() {
  const [vehicles, setVehicles] = useState([]);
  const [alert, setAlert] = useState(null);
  const [status, setStatus] = useState({
    live_simulation_active: true,
    engine_latency_ms: 3.2,
    active_vehicles_count: 2,
    active_alerts_count: 1,
    prevented_incidents_count: 19,
    punctuality_rate: 94.8,
    simulation_speed: 1.0,
  });
  const [route, setRoute] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("1042");
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Fetch static route metadata
  useEffect(() => {
    fetch(`${API_BASE}/route`)
      .then((res) => res.json())
      .then((data) => setRoute(data))
      .catch((err) => console.warn("Could not fetch route:", err));
  }, []);

  // WebSocket connection with fallback polling
  useEffect(() => {
    let isMounted = true;

    function connect() {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.vehicles) setVehicles(data.vehicles);
            if (data.alert !== undefined) setAlert(data.alert);
            if (data.status) setStatus(data.status);
          } catch (e) {
            console.error("Failed to parse WS message", e);
          }
        };

        ws.onerror = () => {
          if (isMounted) setIsConnected(false);
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          // Try reconnect in 2 seconds
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connect, 2000);
      }
    }

    connect();

    // Fallback polling if WS is down
    const pollInterval = setInterval(() => {
      if (!isConnected) {
        fetch(`${API_BASE}/vehicles`)
          .then((r) => r.json())
          .then((v) => isMounted && setVehicles(v))
          .catch(() => {});
        fetch(`${API_BASE}/alerts`)
          .then((r) => r.json())
          .then((a) => isMounted && setAlert(a[0] || null))
          .catch(() => {});
        fetch(`${API_BASE}/status`)
          .then((r) => r.json())
          .then((s) => isMounted && setStatus(s))
          .catch(() => {});
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [isConnected]);

  // Apply Holding intervention
  const applyHolding = useCallback(async (recId = "alert_m3_001") => {
    try {
      const res = await fetch(`${API_BASE}/recommendations/${recId}/apply`, {
        method: "POST",
      });
      const data = await res.json();
      return data;
    } catch (e) {
      console.error("Failed to apply recommendation:", e);
    }
  }, []);

  // Control simulation (play, pause, speed, reset)
  const controlSimulation = useCallback(async (action, speed) => {
    try {
      await fetch(`${API_BASE}/simulation/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, speed }),
      });
    } catch (e) {
      console.error("Failed to send simulation control:", e);
    }
  }, []);

  const selectedVehicle =
    vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0] || null;

  return {
    vehicles,
    alert,
    status,
    route,
    selectedVehicle,
    selectedVehicleId,
    setSelectedVehicleId,
    isConnected,
    applyHolding,
    controlSimulation,
  };
}
