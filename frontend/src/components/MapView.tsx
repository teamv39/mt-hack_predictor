import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import {
  Play,
  Pause,
  SkipBack,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  Crosshair,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Radio,
} from "lucide-react";
import { Vehicle, AlertItem, RouteData, StopPoint } from "../mock/telemetry";
import * as turf from "@turf/turf";

// Explicitly register MapLibre WebWorker URL for Vite
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
}

// Self-hosted autonomous vector tile server endpoints
const TILESERVER_LIGHT = "/tiles/styles/transport/style.json";
const TILESERVER_DARK = "/tiles/styles/transport-dark/style.json";

const HORIZONS = ["Сейчас", "+15 мин", "+30 мин", "+45 мин"];

interface MapViewProps {
  route: RouteData;
  vehicles: Vehicle[];
  alert?: AlertItem | null;
  selectedVehicleId?: string;
  onSelectVehicle: (id: string) => void;
  flyToTarget?: { lat: number; lon: number; zoom?: number } | null;
  timeStep: string;
  onTimeStepChange: (step: string) => void;
  camera?: any;
  isDarkMode: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  route,
  vehicles,
  alert,
  selectedVehicleId,
  onSelectVehicle,
  flyToTarget,
  timeStep,
  onTimeStepChange,
  isDarkMode,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const isFirstRenderRef = useRef(true);
  const onSelectVehicleRef = useRef(onSelectVehicle);
  onSelectVehicleRef.current = onSelectVehicle;

  const vehicleMarkersRef = useRef<{ [id: string]: maplibregl.Marker }>({});
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const headwayMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isTileServerAvailable, setIsTileServerAvailable] = useState<boolean>(true);

  const isHoldingApplied = alert?.recommendation?.applied ?? false;

  // 1. Vehicle positions — interpolate along route.routeGeometry
  const displayedVehicles = useMemo(() => {
    if (timeStep === "Сейчас") return vehicles;

    const routeLine: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: route.routeGeometry },
    };
    const stopDists = route.stops.map((s: StopPoint) =>
      turf.nearestPointOnLine(routeLine, turf.point([s.lon, s.lat])).properties.location as number
    );
    const findNearestStop = (lon: number, lat: number) => {
      const pt = turf.nearestPointOnLine(routeLine, turf.point([lon, lat]));
      const loc = pt.properties.location as number;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < stopDists.length; i++) {
        const d = Math.abs(stopDists[i] - loc);
        if (d < bestD) { bestD = d; best = i; }
      }
      return route.stops[best]?.name || "";
    };

    const horizonFrac: Record<string, { frac1042: number; frac1043: number; holdingFrac1043: number }> = {
      "+15 мин": { frac1042: 0.72, frac1043: 0.38, holdingFrac1043: 0.22 },
      "+30 мин": { frac1042: 0.92, frac1043: 0.62, holdingFrac1043: 0.45 },
      "+45 мин": { frac1042: 1.0, frac1043: 0.82, holdingFrac1043: 0.68 },
    };
    const h = horizonFrac[timeStep];
    if (!h) return vehicles;

    const totalLen = turf.length(routeLine, { units: "kilometers" });
    const ptAlong = (frac: number) => turf.along(routeLine, frac * totalLen, { units: "kilometers" }).geometry.coordinates as [number, number];

    return vehicles.map((veh) => {
      const is1042 = veh.id.includes("1042");
      const is1043 = veh.id.includes("1043");
      if (is1042) {
        const [lon, lat] = ptAlong(h.frac1042);
        const speedKmh = timeStep === "+15 мин" ? 16 : timeStep === "+30 мин" ? 28 : 22;
        return { ...veh, latitude: lat, longitude: lon, speedKmh, currentStop: findNearestStop(lon, lat), nextStop: route.stops[route.stops.length - 1]?.name || "" };
      }
      if (is1043) {
        const frac = isHoldingApplied ? h.holdingFrac1043 : h.frac1043;
        const [lon, lat] = ptAlong(frac);
        const speedKmh = isHoldingApplied ? (timeStep === "+15 мин" ? 26 : timeStep === "+30 мин" ? 29 : 25) : (timeStep === "+15 мин" ? 12 : timeStep === "+30 мин" ? 14 : 25);
        const status: Vehicle["status"] = isHoldingApplied ? "NORMAL" : "BUNCHING_RISK";
        return { ...veh, latitude: lat, longitude: lon, speedKmh, status, currentStop: findNearestStop(lon, lat), nextStop: route.stops[route.stops.length - 1]?.name || "" };
      }
      return veh;
    });
  }, [vehicles, timeStep, isHoldingApplied, route]);

  // 2. Timeline auto-play timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const idx = HORIZONS.indexOf(timeStep);
      const nextIdx = (idx + 1) % HORIZONS.length;
      onTimeStepChange(HORIZONS[nextIdx]);
    }, 3500);
    return () => clearInterval(interval);
  }, [isPlaying, timeStep, onTimeStepChange]);

  // Function to initialize situational vector overlay layers on MapLibre
  const setupSituationalLayers = useCallback(
    (map: maplibregl.Map) => {
      // A. Congestion zone — buffer around congestionSegment
      if (!map.getSource("congestion-zones") && route.congestionSegment.length >= 2) {
        const seg = route.congestionSegment;
        const buf = 0.004;
        const amberCoords = [
          [seg[0][0] - buf, seg[0][1] - buf * 0.6],
          [seg[0][0] - buf * 0.5, seg[0][1] + buf * 0.8],
          [seg[seg.length - 1][0] + buf, seg[seg.length - 1][1] + buf * 0.6],
          [seg[seg.length - 1][0] + buf * 0.5, seg[seg.length - 1][1] - buf * 0.8],
          [seg[0][0] - buf, seg[0][1] - buf * 0.6],
        ];
        const redCoords = [
          [seg[0][0] - buf * 0.4, seg[0][1] - buf * 0.3],
          [seg[0][0] - buf * 0.2, seg[0][1] + buf * 0.5],
          [seg[seg.length - 1][0] + buf * 0.4, seg[seg.length - 1][1] + buf * 0.3],
          [seg[seg.length - 1][0] + buf * 0.2, seg[seg.length - 1][1] - buf * 0.5],
          [seg[0][0] - buf * 0.4, seg[0][1] - buf * 0.3],
        ];

        map.addSource("congestion-zones", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              { type: "Feature", properties: { level: "amber" }, geometry: { type: "Polygon", coordinates: [amberCoords] } },
              { type: "Feature", properties: { level: "red" }, geometry: { type: "Polygon", coordinates: [redCoords] } },
            ],
          },
        });

        map.addLayer({ id: "congestion-amber-fill", type: "fill", source: "congestion-zones", filter: ["==", "level", "amber"], paint: { "fill-color": "#fbbf24", "fill-opacity": isDarkMode ? 0.22 : 0.16 } });
        map.addLayer({ id: "congestion-amber-line", type: "line", source: "congestion-zones", filter: ["==", "level", "amber"], paint: { "line-color": "#d97706", "line-width": 1.5, "line-dasharray": [4, 4] } });
        map.addLayer({ id: "congestion-red-fill", type: "fill", source: "congestion-zones", filter: ["==", "level", "red"], paint: { "fill-color": "#ef4444", "fill-opacity": isDarkMode ? 0.28 : 0.2 } });
        map.addLayer({ id: "congestion-red-line", type: "line", source: "congestion-zones", filter: ["==", "level", "red"], paint: { "line-color": "#dc2626", "line-width": 1.5, "line-dasharray": [3, 3] } });
      }

      // B. Route polyline from route.routeGeometry
      if (!map.getSource("m3-route") && route.routeGeometry.length >= 2) {
        map.addSource("m3-route", {
          type: "geojson",
          data: { type: "Feature", properties: { name: route.name }, geometry: { type: "LineString", coordinates: route.routeGeometry } },
        });
        map.addLayer({ id: "m3-route-line-casing", type: "line", source: "m3-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": isDarkMode ? "#064e3b" : "#ffffff", "line-width": 7, "line-opacity": 0.7 } });
        map.addLayer({ id: "m3-route-line", type: "line", source: "m3-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": isDarkMode ? "#10b981" : "#00875A", "line-width": 5, "line-opacity": 0.95 } });
      }

      // C. Headway connector line source
      if (!map.getSource("headway-connector")) {
        map.addSource("headway-connector", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({ id: "headway-connector-line", type: "line", source: "headway-connector", paint: { "line-color": ["get", "color"], "line-width": 3, "line-dasharray": [4, 4], "line-opacity": 0.9 } });
      }
    },
    [isDarkMode, route]
  );

  // 3. Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = [37.6840, 55.7720];
    const initialZoom = 13;

    const targetStyle = isDarkMode ? TILESERVER_DARK : TILESERVER_LIGHT;

    const map = new maplibregl.Map({
      container: mapContainerRef.current!,
      style: targetStyle,
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 10,
      maxZoom: 17,
      maxBounds: [[36.8, 55.1], [38.2, 56.1]],
      attributionControl: false,
      renderWorldCopies: false,
      transformRequest: (url: string) => {
        const match = url.match(/^https?:\/\/[^/]+(\/(?:data|fonts|styles|sprites)\/.*)$/);
        if (match) {
          return { url: `/tiles${match[1]}` };
        }
        return { url };
      },
    });

    map.on("error", (e) => {
      console.warn("[MapLibre] Tile/resource error (non-fatal):", e?.error?.message);
    });

    map.on("load", () => {
      setIsTileServerAvailable(true);
      setupSituationalLayers(map);
      map.resize();
    });

    mapInstanceRef.current = map;
    setTimeout(() => map.resize(), 200);

    const handleResize = () => mapInstanceRef.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      Object.values(vehicleMarkersRef.current).forEach((m) => m.remove());
      vehicleMarkersRef.current = {};
      stopMarkersRef.current.forEach((m) => m.remove());
      stopMarkersRef.current = [];
      if (headwayMarkerRef.current) {
        headwayMarkerRef.current.remove();
        headwayMarkerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update style on isDarkMode toggle (skip first mount)
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    const targetStyle = isDarkMode ? TILESERVER_DARK : TILESERVER_LIGHT;
    map.setStyle(targetStyle);

    map.once("style.load", () => {
      setupSituationalLayers(map);
    });
  }, [isDarkMode, setupSituationalLayers]);

  // 4. Render Stop Points Markers from route.stops
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    route.stops.forEach((stop) => {
      const el = document.createElement("div");
      el.className = "stop-marker-item";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.gap = "4px";
      el.style.background = isDarkMode ? "#18181b" : "#ffffff";
      el.style.border = isDarkMode ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.12)";
      el.style.borderRadius = "6px";
      el.style.padding = "2px 6px";
      el.style.boxShadow = `0 2px 8px rgba(0,0,0,${isDarkMode ? "0.4" : "0.15"})`;
      el.style.fontSize = "10px";
      el.style.fontWeight = "700";
      el.style.color = isDarkMode ? "#f4f4f5" : "#18181b";
      el.style.whiteSpace = "nowrap";
      el.style.cursor = "default";
      el.style.userSelect = "none";

      el.innerHTML = `
        <span style="width: 6px; height: 6px; border-radius: 50%; background: ${stop.color};"></span>
        <span>${stop.name}</span>
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([stop.lon, stop.lat])
        .addTo(map);

      stopMarkersRef.current.push(marker);
    });
  }, [isDarkMode, route.stops]);

  // 5. Draw and Update Vehicle Markers and Headway Connector dynamically
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const activeIds = new Set(displayedVehicles.map((v) => v.id));

    // Remove obsolete markers
    Object.keys(vehicleMarkersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        vehicleMarkersRef.current[id].remove();
        delete vehicleMarkersRef.current[id];
      }
    });

    displayedVehicles.forEach((veh) => {
      const isSelected = veh.id === selectedVehicleId;
      const isBunching = veh.status === "BUNCHING_RISK";
      const isDelayed = veh.status === "DELAYED";
      const cleanId = veh.id.replace(/^P/, "");

      const badgeBg = isBunching ? "#dc2626" : isDelayed ? "#d97706" : (isDarkMode ? "#27272a" : "#334155");
      const statusText = isBunching
        ? `№${cleanId} • Пачкование ${veh.speedKmh} км/ч`
        : isDelayed
        ? `№${cleanId} • +${Math.round(veh.delaySeconds / 60)}м (${veh.speedKmh} км/ч)`
        : `№${cleanId} • ${veh.speedKmh} км/ч`;

      let marker = vehicleMarkersRef.current[veh.id];

      if (!marker) {
        const el = document.createElement("div");
        el.className = `bus-marker-${veh.id}`;
        el.style.cursor = "pointer";
        el.onclick = () => onSelectVehicleRef.current(veh.id);

        marker = new maplibregl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat([veh.longitude, veh.latitude])
          .addTo(map);

        vehicleMarkersRef.current[veh.id] = marker;
      } else {
        marker.setLngLat([veh.longitude, veh.latitude]);
      }

      // Update inner HTML of vehicle marker
      const el = marker.getElement();
      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          ${
            isBunching || isSelected
              ? `
            <div style="
              position: absolute;
              width: ${isSelected ? "52px" : "44px"};
              height: ${isSelected ? "52px" : "44px"};
              border-radius: 50%;
              background: ${isBunching ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.15)"};
              animation: pulse-ring 2s infinite;
            "></div>
          `
              : ""
          }
          
          <!-- Badge Pill -->
          <div style="
            position: relative;
            z-index: 10;
            display: flex;
            align-items: center;
            gap: 4px;
            background: ${badgeBg};
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 9999px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: ${isSelected ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.2)"};
            white-space: nowrap;
            transition: transform 0.15s ease-in-out;
          ">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></span>
            <span>${statusText}</span>
          </div>
          
          <!-- Vehicle Direction Pin -->
          <div style="
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: ${badgeBg};
            border: ${isSelected ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.2)"};
            margin-top: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          ">
            <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
          </div>
        </div>
      `;
    });

    // 6. Headway Connector between trailing bus and leading bus
    const trailingVeh = displayedVehicles.find((v) => v.id.includes("1043"));
    const leadingVeh = displayedVehicles.find((v) => v.id.includes("1042"));
    const headwaySource = map.getSource("headway-connector") as maplibregl.GeoJSONSource | undefined;

    if (trailingVeh && leadingVeh) {
      const isCritical =
        timeStep === "+15 мин"
          ? !isHoldingApplied
          : trailingVeh.status === "BUNCHING_RISK" || leadingVeh.status === "BUNCHING_RISK";
      const connectorColor = isCritical ? "#ef4444" : "#10b981";

      if (headwaySource) {
        headwaySource.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { color: connectorColor },
              geometry: {
                type: "LineString",
                coordinates: [
                  [trailingVeh.longitude, trailingVeh.latitude],
                  [leadingVeh.longitude, leadingVeh.latitude],
                ],
              },
            },
          ],
        });
      }

      // Midpoint interval tag
      const midLat = (trailingVeh.latitude + leadingVeh.latitude) / 2;
      const midLon = (trailingVeh.longitude + leadingVeh.longitude) / 2;

      let intervalText = "Δ 1.4 мин • Схлопывание";
      if (timeStep === "+15 мин") {
        intervalText = isHoldingApplied
          ? "Δ 7.5 мин • Такт стабилизирован (Holding)"
          : "Δ 1.2 мин • Схлопывание (Пачкование)";
      } else if (timeStep === "+30 мин") {
        intervalText = isHoldingApplied ? "Δ 8.0 мин • Штатный такт" : "Δ 1.5 мин • Пачкование";
      } else if (timeStep === "+45 мин") {
        intervalText = isHoldingApplied ? "Δ 8.5 мин • График в норме" : "Δ 1.8 мин • Нарушение такта";
      }

      if (!headwayMarkerRef.current) {
        const badgeEl = document.createElement("div");
        badgeEl.className = "headway-badge";
        headwayMarkerRef.current = new maplibregl.Marker({
          element: badgeEl,
          anchor: "center",
        })
          .setLngLat([midLon, midLat])
          .addTo(map);
      } else {
        headwayMarkerRef.current.setLngLat([midLon, midLat]);
      }

      const el = headwayMarkerRef.current.getElement();
      el.innerHTML = `
        <div style="
          background: ${isCritical ? "#dc2626" : "#00875A"};
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 2px 8px;
          border-radius: 9999px;
          border: 1.5px solid #ffffff;
          box-shadow: 0 2px 10px ${isCritical ? "rgba(220, 38, 38, 0.5)" : "rgba(0, 135, 90, 0.4)"};
          white-space: nowrap;
        ">
          ${intervalText}
        </div>
      `;
    } else {
      if (headwaySource) {
        headwaySource.setData({
          type: "FeatureCollection",
          features: [],
        });
      }
      if (headwayMarkerRef.current) {
        headwayMarkerRef.current.remove();
        headwayMarkerRef.current = null;
      }
    }
  }, [displayedVehicles, selectedVehicleId, isDarkMode, timeStep, isHoldingApplied]);

  // FlyTo handler
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && flyToTarget) {
      map.flyTo({
        center: [flyToTarget.lon, flyToTarget.lat],
        zoom: flyToTarget.zoom || 14,
        duration: 1200,
      });
    }
  }, [flyToTarget]);

  // Track click handler for smooth seeking
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const stepIdx = Math.round(ratio * (HORIZONS.length - 1));
    onTimeStepChange(HORIZONS[stepIdx]);
  };

  const handleNextStep = () => {
    const idx = HORIZONS.indexOf(timeStep);
    const nextIdx = Math.min(HORIZONS.length - 1, idx + 1);
    onTimeStepChange(HORIZONS[nextIdx]);
  };

  const handlePrevStep = () => {
    const idx = HORIZONS.indexOf(timeStep);
    const prevIdx = Math.max(0, idx - 1);
    onTimeStepChange(HORIZONS[prevIdx]);
  };

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden select-none">
      {/* 1. MapLibre GL Map Viewport */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* 2. Floating Map Tools (Right side of left panel) */}
      <div className="absolute top-5 left-[365px] z-20 flex flex-col gap-1 p-1.5 rounded-xl border border-white/10 bg-[#18181b]/95 text-zinc-200 shadow-xl shadow-black/25 pointer-events-auto backdrop-blur-xl transition-all">
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-zinc-800 text-zinc-300 hover:text-white"
          title="Приблизить"
        >
          <Plus size={15} />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-zinc-800 text-zinc-300 hover:text-white"
          title="Отдалить"
        >
          <Minus size={15} />
        </button>
        <div className="h-px my-0.5 bg-zinc-700" />
        <button
          onClick={() =>
            mapInstanceRef.current?.flyTo({
              center: [37.6840, 55.7720],
              zoom: 13,
              duration: 1000,
            })
          }
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-zinc-800 text-zinc-300 hover:text-white"
          title="Центрировать на перегоне"
        >
          <Crosshair size={14} />
        </button>
        <button
          onClick={() => {
            const map = mapInstanceRef.current;
            if (map) {
              const currentPitch = map.getPitch();
              map.easeTo({ pitch: currentPitch > 20 ? 0 : 45, duration: 800 });
            }
          }}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-zinc-800 text-zinc-300 hover:text-white"
          title="Переключить перспективу 2D/2.5D"
        >
          <Layers size={14} />
        </button>
      </div>

      {/* 3. Floating Bottom Center Horizon Scrubber Capsule */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center gap-1.5">
        {/* ML Horizon Mode Indicator Badge */}
        {timeStep === "+15 мин" ? (
          <div
            className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-lg border backdrop-blur-md transition-all ${
              isHoldingApplied
                ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
                : "bg-rose-950/80 text-rose-300 border-rose-800/60 animate-pulse"
            }`}
          >
            {isHoldingApplied ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            <span>
              {isHoldingApplied
                ? "ГОРИЗОНТ T+15 мин: ИНТЕРВАЛ СТАБИЛИЗИРОВАН (HOLDING ПРИМЕНЕН)"
                : "ГОРИЗОНТ ПРЕДИКТА ML T+15 мин: ПРОГНОЗ СХЛОПЫВАНИЯ ИНТЕРВАЛА"}
            </span>
          </div>
        ) : timeStep === "Сейчас" ? (
          <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow border backdrop-blur-md bg-[#18181b]/95 text-zinc-300 border-white/10">
            <Radio size={11} className="text-emerald-500 shrink-0" />
            <span>ОНЛАЙН ТЕЛЕМЕТРИЯ NDTP • ТЕКУЩИЙ МОМЕНТ</span>
          </div>
        ) : (
          <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow border backdrop-blur-md bg-[#18181b]/95 text-zinc-400 border-white/10">
            <span>ПРОГНОЗНЫЙ ГОРИЗОНТ ДВИЖЕНИЯ {timeStep}</span>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 shadow-2xl shadow-black/35 px-4 py-2.5 flex items-center gap-3 w-[460px] max-w-[calc(100vw-750px)] backdrop-blur-xl bg-[#18181b]/95 text-zinc-200 transition-colors">
          {/* Play/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm shrink-0 cursor-pointer ${
              isPlaying
                ? isDarkMode ? "bg-zinc-700 text-white" : "bg-zinc-800 text-white"
                : isDarkMode
                ? "bg-zinc-800 hover:bg-zinc-700 text-white"
                : "bg-zinc-900 hover:bg-zinc-800 text-white"
            }`}
            title={isPlaying ? "Остановить анимацию" : "Запустить просмотр во времени"}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>

          {/* Rewind */}
          <button
            onClick={() => onTimeStepChange("Сейчас")}
            className={`transition-colors shrink-0 cursor-pointer ${
              timeStep === "Сейчас"
                ? "text-zinc-200 font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="К текущему моменту (Сейчас)"
          >
            <SkipBack size={15} />
          </button>

          {/* Step Back */}
          <button
            onClick={handlePrevStep}
            className="text-zinc-400 hover:text-zinc-200 transition-colors shrink-0 cursor-pointer"
            title="Предыдущий горизонт"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Time Steps and Track */}
          <div className="flex-1 flex flex-col gap-1.5 px-1">
            {/* Slider track with active thumb - CLICKABLE */}
            <div
              onClick={handleTrackClick}
              className={`relative w-full h-2 rounded-full flex items-center cursor-pointer ${
                isDarkMode ? "bg-zinc-700/80" : "bg-zinc-200"
              }`}
            >
              <div
                className="h-full bg-zinc-400 dark:bg-zinc-500 rounded-full transition-all"
                style={{
                  width:
                    timeStep === "Сейчас"
                      ? "8%"
                      : timeStep === "+15 мин"
                      ? "42%"
                      : timeStep === "+30 мин"
                      ? "75%"
                      : "100%",
                }}
              />
              <div
                className={`absolute w-3.5 h-3.5 rounded-full border-2 border-zinc-400 dark:border-zinc-300 shadow-md transition-all ${
                  isDarkMode ? "bg-zinc-900" : "bg-white"
                }`}
                style={{
                  left:
                    timeStep === "Сейчас"
                      ? "8%"
                      : timeStep === "+15 мин"
                      ? "42%"
                      : timeStep === "+30 мин"
                      ? "75%"
                      : "100%",
                  transform: "translateX(-50%)",
                }}
              />
            </div>

            {/* Step buttons row */}
            <div className="flex justify-between items-center text-[10px] font-semibold">
              <button
                onClick={() => onTimeStepChange("Сейчас")}
                className={`cursor-pointer transition-colors ${
                  timeStep === "Сейчас"
                    ? isDarkMode
                      ? "text-zinc-100 font-extrabold"
                      : "text-zinc-900 font-extrabold"
                    : isDarkMode
                    ? "text-zinc-400 hover:text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Сейчас
              </button>

              <button
                onClick={() => onTimeStepChange("+15 мин")}
                className={`px-1.5 py-0.5 rounded cursor-pointer transition-all ${
                  timeStep === "+15 мин"
                    ? isDarkMode
                      ? "bg-amber-950/50 text-amber-300 font-extrabold border border-amber-600/50"
                      : "bg-amber-50 text-amber-900 font-extrabold border border-amber-300"
                    : isDarkMode
                    ? "text-zinc-400 hover:text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                +15м (ML)
              </button>

              <button
                onClick={() => onTimeStepChange("+30 мин")}
                className={`cursor-pointer transition-colors ${
                  timeStep === "+30 мин"
                    ? isDarkMode
                      ? "text-white font-extrabold"
                      : "text-zinc-900 font-extrabold"
                    : isDarkMode
                    ? "text-zinc-400 hover:text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                +30м
              </button>

              <button
                onClick={() => onTimeStepChange("+45 мин")}
                className={`cursor-pointer transition-colors ${
                  timeStep === "+45 мин"
                    ? isDarkMode
                      ? "text-white font-extrabold"
                      : "text-zinc-900 font-extrabold"
                    : isDarkMode
                    ? "text-zinc-400 hover:text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                +45м
              </button>
            </div>
          </div>

          {/* Next Arrow */}
          <button
            onClick={handleNextStep}
            className="text-zinc-400 hover:text-zinc-200 transition-colors shrink-0 cursor-pointer"
            title="Следующий горизонт"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Subtle source attribution */}
        <div className={`text-[9px] text-center font-medium ${isDarkMode ? "text-zinc-500" : "text-zinc-400"}`}>
          {isTileServerAvailable
            ? "Автономная векторная карта Москвы (TileServer GL • Planetiler) • СППР Мосгортранс"
            : "Резервная карта (TileServer GL offline) • СППР Мосгортранс"}
        </div>
      </div>
    </div>
  );
};

export default MapView;
