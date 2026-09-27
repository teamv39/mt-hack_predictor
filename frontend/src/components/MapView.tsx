import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import {
  Play,
  Pause,
  SkipBack,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Crosshair,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Radio,
  Eye,
  EyeOff,
  Route,
  Navigation,
  Bus,
  MapPin,
  Flame,
  Activity,
  Search,
  X,
} from "lucide-react";
import { Vehicle, AlertItem, RouteData } from "../mock/telemetry";
import { normalizeRouteId, type DataMode } from "../hooks/useTelemetry";
import * as turf from "@turf/turf";

// Explicitly register MapLibre WebWorker URL for Vite
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
}

// Self-hosted autonomous vector tile server endpoints
const TILESERVER_LIGHT = "/tiles/styles/transport/style.json";
const TILESERVER_DARK = "/tiles/styles/transport-dark/style.json";

// CartoDB Positron (Light) & Dark Matter (Dark) resilient fallbacks
const CARTO_LIGHT_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "carto-raster": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors, © CARTO",
    },
  },
  layers: [
    {
      id: "carto-raster-layer",
      type: "raster",
      source: "carto-raster",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function splitRouteIntoSegments(coords: [number, number][], maxJumpKm = 1.5): [number, number][][] {
  if (coords.length < 2) return [coords];
  const segments: [number, number][][] = [];
  let current: [number, number][] = [coords[0]];

  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const dLat = (curr[1] - prev[1]) * 111.0;
    const dLon = (curr[0] - prev[0]) * 63.0;
    const distKm = Math.sqrt(dLat * dLat + dLon * dLon);

    if (distKm > maxJumpKm) {
      if (current.length >= 2) {
        segments.push(current);
      }
      current = [curr];
    } else {
      current.push(curr);
    }
  }

  if (current.length >= 2) {
    segments.push(current);
  }
  return segments.length > 0 ? segments : [coords];
}

function buildRouteFeature(
  name: string,
  routeId: string,
  geometry: [number, number][],
  sublines?: [number, number][][]
): GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString> {
  if (sublines && sublines.length > 0) {
    return {
      type: "Feature",
      properties: { name, routeId },
      geometry: { type: "MultiLineString", coordinates: sublines },
    };
  }
  const segments = splitRouteIntoSegments(geometry, 1.5);
  if (segments.length > 1) {
    return {
      type: "Feature",
      properties: { name, routeId },
      geometry: { type: "MultiLineString", coordinates: segments },
    };
  }
  return {
    type: "Feature",
    properties: { name, routeId },
    geometry: { type: "LineString", coordinates: segments[0] || geometry },
  };
}

function isLineGeometryFeature(value: unknown): value is GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString> {
  if (!isRecord(value) || value.type !== "Feature" || !isRecord(value.geometry)) return false;
  const geomType = value.geometry.type;
  if (geomType !== "LineString" && geomType !== "MultiLineString") return false;
  return Array.isArray(value.geometry.coordinates) && value.geometry.coordinates.length > 0;
}

const CARTO_DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "carto-raster": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors, © CARTO",
    },
  },
  layers: [
    {
      id: "carto-raster-layer",
      type: "raster",
      source: "carto-raster",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

const HORIZONS = ["Сейчас", "+15 мин", "+30 мин", "+45 мин"];

interface MapViewProps {
  routes: RouteData[];
  vehicles: Vehicle[];
  dataMode?: DataMode;
  datasetLoadError?: string | null;
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
  routes,
  vehicles,
  dataMode = "mock",
  datasetLoadError = null,
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
  useEffect(() => {
    onSelectVehicleRef.current = onSelectVehicle;
  }, [onSelectVehicle]);

  const vehicleMarkersRef = useRef<{ [id: string]: maplibregl.Marker }>({});
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const headwayMarkerRef = useRef<maplibregl.Marker | null>(null);
  const isTileServerAvailableRef = useRef<boolean>(true);
  const setupSituationalLayersRef = useRef<(map: maplibregl.Map) => void>(() => {});

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [mapStyleRevision, setMapStyleRevision] = useState(0);
  const [isTileServerAvailable, setIsTileServerAvailable] = useState<boolean>(true);
  const [visibleRouteIds, setVisibleRouteIds] = useState<string[]>(() =>
    routes.map((r) => normalizeRouteId(r.routeId))
  );
  const [trackGeoJson, setTrackGeoJson] = useState<Record<string, GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>>>({});
  const [isRoutesCollapsed, setIsRoutesCollapsed] = useState<boolean>(false);
  const [routeSearch, setRouteSearch] = useState<string>("");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const activeRouteNormId = selectedRouteId || (alert?.routeId ? normalizeRouteId(alert.routeId) : null);

  useEffect(() => {
    if (alert?.routeId) {
      const norm = normalizeRouteId(alert.routeId);
      setSelectedRouteId(norm);
      setVisibleRouteIds((prev) => (prev.includes(norm) ? prev : [...prev, norm]));
    }
  }, [alert?.id, alert?.routeId]);

  useEffect(() => {
    setVisibleRouteIds((previous) => {
      const available = routes.map((route) => normalizeRouteId(route.routeId));
      if (previous.length === 0) return available;
      const retained = previous.filter((routeId) => available.includes(routeId));
      return retained.length > 0 ? retained : available;
    });
  }, [routes]);

  useEffect(() => {
    let cancelled = false;

    if (dataMode === "dataset" || datasetLoadError || routes.length === 0) {
      setTrackGeoJson({});
      return () => {
        cancelled = true;
      };
    }

    const loadGeoJson = async () => {
      const entries = await Promise.all(routes.map(async (route) => {
        const routeId = normalizeRouteId(route.routeId);
        // If route already contains geometry points from dataset, construct clean segmented LineString/MultiLineString locally
        if (route.routeGeometry && route.routeGeometry.length >= 2) {
          const feature = buildRouteFeature(route.name, routeId, route.routeGeometry);
          return [routeId, feature] as const;
        }

        // Only query backend if routeId is a valid positive integer (GPS track ID)
        if (!/^\d+$/.test(route.routeId)) {
          return null;
        }

        try {
          const response = await fetch(`/api/v1/tracks/${encodeURIComponent(route.routeId)}/geojson`);
          if (!response.ok) return null;
          const value: unknown = await response.json();
          if (!isLineGeometryFeature(value)) return null;
          return [routeId, value] as const;
        } catch {
          return null;
        }
      }));
      if (cancelled) return;
      setTrackGeoJson(Object.fromEntries(entries.filter((entry): entry is readonly [string, GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>] => entry !== null)));
    };

    void loadGeoJson();
    return () => {
      cancelled = true;
    };
  }, [dataMode, datasetLoadError, routes]);

  // Layer visibility toggles
  const [layers, setLayers] = useState({
    vehicles: true,
    stops: true,
    congestion: true,
    headway: true,
    routes: true,
  });
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);

  const primaryRoute = useMemo(
    () => routes.find((r) => normalizeRouteId(r.routeId) === "м3") || routes[0],
    [routes]
  );

  const isHoldingApplied = alert?.recommendation?.applied ?? false;
  const isGpsMode = dataMode === "dataset" && !datasetLoadError;

  // 1. Vehicle positions — interpolate along route geometry when advancing timeline
  const displayedVehicles = useMemo(() => {
    if (dataMode === "dataset" && !datasetLoadError) return vehicles;
    if (timeStep === "Сейчас" || dataMode === "mock") return vehicles;

    const horizonFrac: Record<
      string,
      { frac1042: number; frac1043: number; holdingFrac1043: number; stepOffset: number }
    > = {
      "+15 мин": { frac1042: 0.72, frac1043: 0.38, holdingFrac1043: 0.22, stepOffset: 0.15 },
      "+30 мин": { frac1042: 0.92, frac1043: 0.62, holdingFrac1043: 0.45, stepOffset: 0.3 },
      "+45 мин": { frac1042: 1.0, frac1043: 0.82, holdingFrac1043: 0.68, stepOffset: 0.45 },
    };
    const h = horizonFrac[timeStep];
    if (!h) return vehicles;

    // Helper to interpolate along any route's geometry
    const interpolateAlongRoute = (
      routeGeom: [number, number][],
      targetFrac: number
    ): [number, number] => {
      if (routeGeom.length < 2) return [37.684, 55.772];
      const routeGeoJSON: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: routeGeom },
      };
      const totalLen = turf.length(routeGeoJSON, { units: "kilometers" });
      const clampedFrac = Math.max(0.01, Math.min(0.99, targetFrac));
      return turf.along(routeGeoJSON, clampedFrac * totalLen, { units: "kilometers" })
        .geometry.coordinates as [number, number];
    };

    return vehicles.map((veh) => {
      const is1042 = veh.id.includes("1042");
      const is1043 = veh.id.includes("1043");

      if (is1042 && primaryRoute) {
        const [lon, lat] = interpolateAlongRoute(primaryRoute.routeGeometry, h.frac1042);
        const speedKmh = timeStep === "+15 мин" ? 16 : timeStep === "+30 мин" ? 28 : 22;
        return {
          ...veh,
          latitude: lat,
          longitude: lon,
          speedKmh,
          currentStop: "Бакунинская ул., 84",
          nextStop: "м. Семёновская",
        };
      }

      if (is1043 && primaryRoute) {
        const frac = isHoldingApplied ? h.holdingFrac1043 : h.frac1043;
        const [lon, lat] = interpolateAlongRoute(primaryRoute.routeGeometry, frac);
        const speedKmh = isHoldingApplied
          ? timeStep === "+15 мин"
            ? 26
            : timeStep === "+30 мин"
            ? 29
            : 25
          : timeStep === "+15 мин"
          ? 12
          : timeStep === "+30 мин"
          ? 14
          : 25;
        const status: Vehicle["status"] = isHoldingApplied ? "NORMAL" : "BUNCHING_RISK";
        return {
          ...veh,
          latitude: lat,
          longitude: lon,
          speedKmh,
          status,
          currentStop: isHoldingApplied ? "м. Бауманская (Holding)" : "Бакунинская ул.",
          nextStop: "м. Электрозаводская",
        };
      }

      // Smooth progression for vehicles on other routes
      const vRoute = routes.find((r) => normalizeRouteId(r.routeId) === normalizeRouteId(veh.routeId));
      if (vRoute && vRoute.routeGeometry.length >= 2) {
        const hash = Array.from(veh.id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const baseFrac = ((hash % 7) + 1) / 10;
        const shiftedFrac = (baseFrac + h.stepOffset) % 0.95;
        const [lon, lat] = interpolateAlongRoute(vRoute.routeGeometry, shiftedFrac);
        return { ...veh, latitude: lat, longitude: lon };
      }

      return veh;
    });
  }, [vehicles, timeStep, isHoldingApplied, primaryRoute, routes, dataMode, datasetLoadError]);

  // 2. Timeline auto-play timer (disabled in mock/dataset to allow smooth continuous GPS simulation)
  useEffect(() => {
    if (!isPlaying || dataMode === "mock" || dataMode === "dataset") return;
    const interval = setInterval(() => {
      const idx = HORIZONS.indexOf(timeStep);
      const nextIdx = (idx + 1) % HORIZONS.length;
      onTimeStepChange(HORIZONS[nextIdx]);
    }, 3500);
    return () => clearInterval(interval);
  }, [isPlaying, timeStep, dataMode, onTimeStepChange]);

  // Function to initialize situational vector overlay layers on MapLibre
  const setupSituationalLayers = useCallback(
    (map: maplibregl.Map) => {
      // In dataset mode, remove all route lines completely per user requirement
      const routeSourceIds = Object.keys(map.getStyle().sources).filter((id) => id.startsWith("route-"));
      if (dataMode === "dataset") {
        routeSourceIds.forEach((srcId) => {
          [`${srcId}-line`, `${srcId}-casing`].forEach((layerId) => {
            if (map.getLayer(layerId)) map.removeLayer(layerId);
          });
          map.removeSource(srcId);
        });
        ["congestion-amber-fill", "congestion-amber-line", "congestion-red-fill", "congestion-red-line", "headway-connector-line"].forEach((layerId) => {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        });
        ["congestion-zones", "headway-connector"].forEach((sourceId) => {
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        });
        return;
      }

      routeSourceIds.forEach((srcId) => {
        if (routes.some((route) => `route-${normalizeRouteId(route.routeId)}` === srcId && route.routeGeometry.length >= 2)) return;
        [`${srcId}-line`, `${srcId}-casing`].forEach((layerId) => {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        });
        map.removeSource(srcId);
      });

      const alertedRouteNormId = alert?.routeId ? normalizeRouteId(alert.routeId) : null;
      const activeRouteNormId = selectedRouteId || alertedRouteNormId;
      const hasActiveRoute = activeRouteNormId !== null;

      routes.forEach((r) => {
        if (r.routeGeometry.length < 2) return;
        const normId = normalizeRouteId(r.routeId);
        const srcId = `route-${normId}`;
        const routeData: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString> = dataMode === "dataset" && trackGeoJson[normId]
          ? trackGeoJson[normId]
          : buildRouteFeature(r.name, normId, r.routeGeometry, r.sublines);
        const source = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
        if (source) source.setData(routeData);
        else map.addSource(srcId, { type: "geojson", data: routeData });

        const visibility = layers.routes && visibleRouteIds.includes(normId) ? "visible" : "none";
        const isActive = hasActiveRoute && normId === activeRouteNormId;
        const isAlerted = alertedRouteNormId !== null && normId === alertedRouteNormId;

        const casingWidth = isActive ? 12 : hasActiveRoute ? 4.5 : 6;
        const casingColor = isAlerted
          ? (alert?.category === "bunching" || alert?.tagType === "bunching" ? "#ef4444" : "#f59e0b")
          : isActive
          ? (isDarkMode ? "#ffffff" : "#0f172a")
          : (isDarkMode ? "#09090b" : "#ffffff");
        const casingOpacity = isActive ? 0.95 : hasActiveRoute ? 0.15 : 0.65;
        const casingBlur = isActive ? 2.0 : 0;

        const lineWidth = isActive ? 6.5 : hasActiveRoute ? 2.8 : 3.8;
        const lineOpacity = isActive ? 1.0 : hasActiveRoute ? 0.35 : 0.90;

        if (!map.getLayer(`${srcId}-casing`)) {
          map.addLayer({
            id: `${srcId}-casing`,
            type: "line",
            source: srcId,
            layout: { "line-cap": "round", "line-join": "round", visibility },
            paint: {
              "line-color": casingColor,
              "line-width": casingWidth,
              "line-opacity": casingOpacity,
              "line-blur": casingBlur,
            },
          });
        }
        if (!map.getLayer(`${srcId}-line`)) {
          map.addLayer({
            id: `${srcId}-line`,
            type: "line",
            source: srcId,
            layout: { "line-cap": "round", "line-join": "round", visibility },
            paint: {
              "line-color": r.color,
              "line-width": lineWidth,
              "line-opacity": lineOpacity,
            },
          });
        }
        map.setLayoutProperty(`${srcId}-casing`, "visibility", visibility);
        map.setLayoutProperty(`${srcId}-line`, "visibility", visibility);
        map.setPaintProperty(`${srcId}-casing`, "line-color", casingColor);
        map.setPaintProperty(`${srcId}-casing`, "line-width", casingWidth);
        map.setPaintProperty(`${srcId}-casing`, "line-opacity", casingOpacity);
        map.setPaintProperty(`${srcId}-casing`, "line-blur", casingBlur);
        map.setPaintProperty(`${srcId}-line`, "line-color", r.color);
        map.setPaintProperty(`${srcId}-line`, "line-width", lineWidth);
        map.setPaintProperty(`${srcId}-line`, "line-opacity", lineOpacity);
      });

      // Z-Order: Bring active route layers to the very top so no other route can overlap it
      if (activeRouteNormId) {
        const activeSrc = `route-${activeRouteNormId}`;
        try {
          if (map.getLayer(`${activeSrc}-casing`)) map.moveLayer(`${activeSrc}-casing`);
          if (map.getLayer(`${activeSrc}-line`)) map.moveLayer(`${activeSrc}-line`);
        } catch {
          /* */
        }
      }

      // B. Congestion zones — dynamically populated based on active alerts and visible routes
      if (!map.getSource("congestion-zones")) {
        map.addSource("congestion-zones", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        map.addLayer({
          id: "congestion-amber-fill",
          type: "fill",
          source: "congestion-zones",
          filter: ["==", "level", "amber"],
          paint: {
            "fill-color": "#fbbf24",
            "fill-opacity": isDarkMode ? 0.24 : 0.18,
          },
        });
        map.addLayer({
          id: "congestion-amber-line",
          type: "line",
          source: "congestion-zones",
          filter: ["==", "level", "amber"],
          paint: {
            "line-color": "#d97706",
            "line-width": 1.5,
            "line-dasharray": [4, 4],
          },
        });
        map.addLayer({
          id: "congestion-red-fill",
          type: "fill",
          source: "congestion-zones",
          filter: ["==", "level", "red"],
          paint: {
            "fill-color": "#ef4444",
            "fill-opacity": isDarkMode ? 0.32 : 0.22,
          },
        });
        map.addLayer({
          id: "congestion-red-line",
          type: "line",
          source: "congestion-zones",
          filter: ["==", "level", "red"],
          paint: {
            "line-color": "#dc2626",
            "line-width": 1.8,
            "line-dasharray": [3, 3],
          },
        });
      }

      // C. Headway connector line source
      if (!map.getSource("headway-connector")) {
        map.addSource("headway-connector", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "headway-connector-line",
          type: "line",
          source: "headway-connector",
          paint: {
            "line-color": ["get", "color"],
            "line-width": 3.5,
            "line-dasharray": [4, 4],
            "line-opacity": 0.95,
          },
        });
      }
    },
    [dataMode, datasetLoadError, isDarkMode, layers.routes, routes, trackGeoJson, visibleRouteIds, selectedRouteId, alert]
  );
  setupSituationalLayersRef.current = setupSituationalLayers;

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && map.isStyleLoaded()) setupSituationalLayers(map);
  }, [setupSituationalLayers]);

  const getStyleForTheme = useCallback(
    (dark: boolean, useLocalTiles: boolean): string | maplibregl.StyleSpecification => {
      if (useLocalTiles) {
        return dark ? TILESERVER_DARK : TILESERVER_LIGHT;
      }
      return dark ? CARTO_DARK_STYLE : CARTO_LIGHT_STYLE;
    },
    []
  );

  // 3. Initialize MapLibre GL Map with auto-probe and fallback
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let isDestroyed = false;
    let fallbackTriggered = false;

    const initMapWithCheck = async () => {
      let localOk = true;
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(TILESERVER_LIGHT, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok && res.status >= 500) {
          localOk = false;
        }
      } catch {
        // Keep localOk = true on latency / probe timeout.
        // The runtime map.on("error") watchdog below will smoothly activate
        // CartoDB fallback if TileServer GL is genuinely unreachable.
        localOk = true;
      }

      if (isDestroyed || !mapContainerRef.current) return;

      isTileServerAvailableRef.current = localOk;
      setIsTileServerAvailable(localOk);

      const initialCenter: [number, number] = [37.684, 55.772];
      const initialZoom = 13;
      const targetStyle = getStyleForTheme(isDarkMode, localOk);

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: targetStyle,
        center: initialCenter,
        zoom: initialZoom,
        minZoom: 10,
        maxZoom: 18,
        maxBounds: [
          [36.8, 55.1],
          [38.2, 56.1],
        ],
        attributionControl: false,
        renderWorldCopies: false,
        transformRequest: (url: string) => {
          try {
            const parsed = new URL(url, window.location.origin);
            const pathname = parsed.pathname;

            // 1. If URL already points to /tiles/... (relative or absolute on any port/host)
            if (pathname.startsWith("/tiles/")) {
              return { url: `${pathname}${parsed.search}` };
            }

            // 2. If URL points to TileServer sub-resources (/data/..., /fonts/..., /styles/..., /sprites/...)
            if (/^\/(?:data|fonts|styles|sprites)\//.test(pathname)) {
              return { url: `/tiles${pathname}${parsed.search}` };
            }
          } catch {
            if (url.startsWith("/tiles/")) return { url };
            if (/^\/(?:data|fonts|styles|sprites)\//.test(url)) return { url: `/tiles${url}` };
          }
          return { url };
        },
      });

      let consecutiveFatalErrors = 0;

      // Runtime error watchdog: only trigger fallback on true server outage, NOT on normal 404s for missing boundary tiles
      map.on("error", (e) => {
        const errEvt = e as { status?: number; error?: { message?: string; status?: number } };
        const errMsg = errEvt?.error?.message || "";
        const status = errEvt?.status || errEvt?.error?.status;

        // Normal 404s for boundary/out-of-range tiles or missing fonts should NOT trigger fallback
        if (status === 404) {
          return;
        }

        console.warn("[MapLibre] Resource error:", errMsg, "Status:", status);

        const isFatalOutage =
          status === 503 ||
          errMsg.includes("tileserver_offline") ||
          errMsg.includes("ECONNREFUSED") ||
          errMsg.includes("Failed to fetch");

        if (isFatalOutage) {
          consecutiveFatalErrors++;
        }

        if (
          !fallbackTriggered &&
          isTileServerAvailableRef.current &&
          (consecutiveFatalErrors >= 5 || (errMsg.includes("style") && isFatalOutage))
        ) {
          fallbackTriggered = true;
          isTileServerAvailableRef.current = false;
          setIsTileServerAvailable(false);
          console.warn("[MapLibre] Local TileServer unavailable, activating CartoDB fallback...");
          map.setStyle(getStyleForTheme(isDarkMode, false));
        }
      });

      map.on("style.load", () => {
        setupSituationalLayersRef.current(map);
        setMapStyleRevision((revision) => revision + 1);
        map.resize();
      });

      mapInstanceRef.current = map;
      setTimeout(() => map.resize(), 200);
    };

    const handleResize = () => mapInstanceRef.current?.resize();
    window.addEventListener("resize", handleResize);

    initMapWithCheck();

    return () => {
      isDestroyed = true;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update style on isDarkMode toggle (skip first mount)
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    const targetStyle = getStyleForTheme(isDarkMode, isTileServerAvailableRef.current);
    map.setStyle(targetStyle);

    map.once("style.load", () => {
      setupSituationalLayersRef.current(map);
      setMapStyleRevision((revision) => revision + 1);
    });
  }, [isDarkMode, getStyleForTheme]);

  // 4. Render Stop Points Markers with clear hierarchy (Key/Metro vs Intermediate Stops)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    if (!layers.stops) return;

    routes.forEach((r) => {
      const normRoute = normalizeRouteId(r.routeId);
      if (!visibleRouteIds.includes(normRoute)) return;

      r.stops.forEach((stop) => {
        const isHoldingStop = stop.name.includes("Бауманская") && normRoute === "м3";
        const isMetroStop =
          stop.name.startsWith("м.") ||
          stop.name.includes("вокзал") ||
          stop.name.includes("Сокольники") ||
          stop.name.includes("Лубянка");

        const el = document.createElement("div");
        el.className = `stop-marker-${stop.id}`;

        if (isHoldingStop) {
          // Special Prominent Holding Zone Marker for Dispatcher
          el.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; pointer-events: auto;">
              <div style="
                display: flex; align-items: center; gap: 5px;
                background: ${isHoldingApplied ? "#064e3b" : "#7f1d1d"};
                color: #ffffff;
                font-size: 11px;
                font-weight: 800;
                padding: 3px 8px;
                border-radius: 8px;
                border: 2px solid ${isHoldingApplied ? "#10b981" : "#ef4444"};
                box-shadow: 0 4px 14px rgba(0,0,0,0.5);
                white-space: nowrap;
              ">
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${isHoldingApplied ? "#34d399" : "#f87171"};"></span>
                <span>${isHoldingApplied ? "Holding активен" : "Зона Holding"}</span>
                <span style="opacity: 0.85;">· м. Бауманская</span>
              </div>
              <div style="
                width: 12px; height: 12px; border-radius: 50%;
                background: ${isHoldingApplied ? "#10b981" : "#ef4444"};
                border: 2.5px solid #ffffff; margin-top: 2px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.4);
              "></div>
            </div>
          `;
        } else if (isMetroStop) {
          // Metro / Major Station: neat badge with authentic Metro 'M' icon
          const cleanStationName = stop.name.replace(/^м\.\s*/, "");
          el.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; pointer-events: auto;">
              <div style="
                display: flex; align-items: center; gap: 4px;
                background: ${isDarkMode ? "rgba(24, 24, 27, 0.94)" : "rgba(255, 255, 255, 0.96)"};
                color: ${isDarkMode ? "#f4f4f5" : "#18181b"};
                border: 1px solid ${isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"};
                font-size: 10px;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.25);
                white-space: nowrap;
              ">
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; border-radius: 3px; background: #ef4444; color: #fff; font-size: 9px; font-weight: 900;">М</span>
                <span>${cleanStationName}</span>
              </div>
              <div style="
                width: 8px; height: 8px; border-radius: 50%;
                background: ${stop.color};
                border: 1.5px solid ${isDarkMode ? "#18181b" : "#ffffff"};
                margin-top: 2px;
              "></div>
            </div>
          `;
        } else {
          // Intermediate Regular Stop: compact circular dot that reveals name on hover
          el.innerHTML = `
            <div class="stop-dot-wrapper" style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto;">
              <div style="
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${stop.color};
                border: 2px solid ${isDarkMode ? "#18181b" : "#ffffff"};
                box-shadow: 0 1px 4px rgba(0,0,0,0.35);
                transition: transform 0.15s ease;
              "></div>
              <div class="stop-dot-label" style="
                position: absolute;
                bottom: calc(100% + 4px);
                left: 50%;
                transform: translateX(-50%);
                display: none;
                background: ${isDarkMode ? "#18181b" : "#ffffff"};
                color: ${isDarkMode ? "#f4f4f5" : "#18181b"};
                border: 1px solid ${isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"};
                padding: 2px 7px;
                border-radius: 5px;
                font-size: 10px;
                font-weight: 700;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 50;
              ">
                ${stop.name}
              </div>
            </div>
          `;
          el.onmouseenter = () => {
            const lbl = el.querySelector(".stop-dot-label") as HTMLElement;
            if (lbl) lbl.style.display = "block";
          };
          el.onmouseleave = () => {
            const lbl = el.querySelector(".stop-dot-label") as HTMLElement;
            if (lbl) lbl.style.display = "none";
          };
        }

        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([stop.lon, stop.lat])
          .addTo(map);

        stopMarkersRef.current.push(marker);
      });
    });
  }, [isDarkMode, routes, visibleRouteIds, isHoldingApplied, layers.stops, mapStyleRevision]);

  // 5. Draw and Update Vehicle Markers and Headway Connector dynamically
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!layers.vehicles) {
      Object.values(vehicleMarkersRef.current).forEach((m) => m.remove());
      vehicleMarkersRef.current = {};
      return;
    }

    const activeIds = new Set(displayedVehicles.map((v) => v.id));

    // Remove obsolete markers
    Object.keys(vehicleMarkersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        vehicleMarkersRef.current[id].remove();
        delete vehicleMarkersRef.current[id];
      }
    });

    displayedVehicles.forEach((veh) => {
      const normRoute = normalizeRouteId(veh.routeId);

      // Skip vehicles on hidden routes
      if (!visibleRouteIds.includes(normRoute)) {
        if (vehicleMarkersRef.current[veh.id]) {
          vehicleMarkersRef.current[veh.id].remove();
          delete vehicleMarkersRef.current[veh.id];
        }
        return;
      }

      const routeObj = routes.find((r) => normalizeRouteId(r.routeId) === normRoute);
      const routeColor = routeObj?.color || "#3b82f6";
      const isSelected = veh.id === selectedVehicleId;
      const isBunching = veh.status === "BUNCHING_RISK";
      const isDelayed = veh.status === "DELAYED";
      const cleanId = veh.id.replace(/^P/, "");
      const isAlertedVehicle = Boolean(
        alert && (alert.vehicleId === veh.id || alert.vehicleId?.replace(/^P/, "") === cleanId)
      );
      const isHighlighted = isAlertedVehicle || isBunching || isSelected;

      let marker = vehicleMarkersRef.current[veh.id];

      if (!marker) {
        const el = document.createElement("div");
        el.className = `bus-marker-${veh.id}`;
        el.style.width = "24px";
        el.style.height = "24px";
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
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.cursor = "pointer";

      const pulseSize = isAlertedVehicle ? 62 : isSelected ? 56 : 46;
      const pulseMargin = pulseSize / 2;

      el.innerHTML = `
        <div class="relative w-full h-full cursor-pointer group" style="transform: translateZ(0);">
          <!-- Outer Pulsing Radar Ping Wave for Alerted Vehicle -->
          ${
            isAlertedVehicle
              ? `
            <div style="
              position: absolute;
              top: 50%; left: 50%;
              width: ${pulseSize + 18}px;
              height: ${pulseSize + 18}px;
              margin-top: -${(pulseSize + 18) / 2}px;
              margin-left: -${(pulseSize + 18) / 2}px;
              border-radius: 50%;
              border: 2px solid ${isBunching || alert?.category === "bunching" ? "#ef4444" : "#f59e0b"};
              animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
              pointer-events: none;
              z-index: 1;
            "></div>
          `
              : ""
          }

          <!-- Concentric Selected or Bunching Pulse Halo centered directly on vehicle coordinates -->
          ${
            isHighlighted
              ? `
            <div style="
              position: absolute;
              top: 50%; left: 50%;
              width: ${pulseSize}px;
              height: ${pulseSize}px;
              margin-top: -${pulseMargin}px;
              margin-left: -${pulseMargin}px;
              border-radius: 50%;
              background: ${
                isAlertedVehicle || isBunching
                  ? "rgba(239, 68, 68, 0.38)"
                  : isDelayed
                  ? "rgba(245, 158, 11, 0.35)"
                  : "rgba(56, 189, 248, 0.35)"
              };
              animation: pulse-ring 2s infinite;
              pointer-events: none;
              z-index: 1;
            "></div>
          `
              : ""
          }

          <!-- Direction Pin & Vehicle Circle (Centered exactly at GPS Coordinates) -->
          <div style="
            position: absolute;
            top: 0; left: 0;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: ${isBunching ? "#dc2626" : isDelayed ? "#d97706" : routeColor};
            border: 2px solid #ffffff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            z-index: 10;
          ">
            <!-- Arrow pointing in heading direction -->
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="transform: rotate(${
              veh.heading || 0
            }deg); transform-origin: center;">
              <path d="M12 2L4 20l8-4 8 4L12 2z" />
            </svg>
          </div>

          <!-- Upper Pill Badge: Route Badge + Number + Speed / Status (Floats above vehicle circle) -->
          <div style="
            position: absolute;
            bottom: calc(100% + 4px);
            left: 50%;
            transform: translateX(-50%);
            z-index: 20;
            display: flex;
            align-items: center;
            gap: 5px;
            background: ${isDarkMode ? "rgba(24, 24, 27, 0.95)" : "rgba(255, 255, 255, 0.95)"};
            color: ${isDarkMode ? "#ffffff" : "#0f172a"};
            font-size: 11px;
            font-weight: 700;
            padding: 3px 7px 3px 4px;
            border-radius: 8px;
            border: ${
              isSelected
                ? "2px solid #38bdf8"
                : isBunching
                ? "2px solid #ef4444"
                : isDelayed
                ? "1.5px solid #f59e0b"
                : isDarkMode
                ? "1px solid rgba(255,255,255,0.22)"
                : "1px solid rgba(0,0,0,0.18)"
            };
            box-shadow: 0 4px 14px rgba(0,0,0,${isDarkMode ? "0.55" : "0.22"});
            white-space: nowrap;
            pointer-events: auto;
          ">
            <!-- Route Pill inside Badge -->
            <span style="
              background: ${routeColor};
              color: #ffffff;
              font-size: 10px;
              font-weight: 900;
              padding: 1px 5px;
              border-radius: 5px;
              letter-spacing: -0.2px;
            ">${normRoute}</span>

            <!-- Vehicle ID -->
            <span style="font-weight: 800; font-size: 11px; letter-spacing: -0.2px;">№${cleanId}</span>

            <!-- Status / Speed Indicator (No Emojis) -->
            ${
              isBunching
                ? `
              <span style="display: flex; align-items: center; gap: 3px; background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 1px 5px; border-radius: 4px; font-size: 10px; font-weight: 800;">
                Риск
              </span>
            `
                : isDelayed
                ? `
              <span style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 1px 5px; border-radius: 4px; font-size: 10px; font-weight: 800;">
                +${Math.round(veh.delaySeconds / 60)}м
              </span>
            `
                : `
              <span style="color: ${isDarkMode ? "#a1a1aa" : "#64748b"}; font-size: 10px; font-weight: 600;">
                ${veh.speedKmh} км/ч
              </span>
            `
            }
          </div>

          <!-- Hover Tooltip Card (Floats above pill badge) -->
          <div class="veh-tooltip" style="
            position: absolute;
            bottom: calc(100% + 36px);
            left: 50%;
            transform: translateX(-50%);
            display: none;
            background: ${isDarkMode ? "#18181b" : "#ffffff"};
            color: ${isDarkMode ? "#f4f4f5" : "#18181b"};
            border: 1px solid ${isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"};
            border-radius: 8px;
            padding: 6px 10px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.45);
            font-size: 11px;
            white-space: nowrap;
            z-index: 100;
            pointer-events: none;
          ">
            <div style="font-weight: 800; margin-bottom: 2px;">${veh.model} · ${veh.plateNumber}</div>
            <div style="color: ${isDarkMode ? "#a1a1aa" : "#64748b"}; font-size: 10px;">След: ${veh.nextStop}</div>
            <div style="color: ${
              isBunching ? "#ef4444" : isDelayed ? "#f59e0b" : "#10b981"
            }; font-weight: 700; margin-top: 2px;">
              ${
                isBunching
                  ? "Прогноз схлопывания через 4 ост."
                  : isDelayed
                  ? `Отставание ${Math.round(veh.delaySeconds / 60)} мин`
                  : "Движение строго по графику"
              }
            </div>
          </div>
        </div>
      `;

      el.onmouseenter = () => {
        const tip = el.querySelector(".veh-tooltip") as HTMLElement;
        if (tip) tip.style.display = "block";
      };
      el.onmouseleave = () => {
        const tip = el.querySelector(".veh-tooltip") as HTMLElement;
        if (tip) tip.style.display = "none";
      };
    });

    // 6. Headway Connector between trailing bus and leading bus
    const trailingVeh = displayedVehicles.find((v) => v.id.includes("1043"));
    const leadingVeh = displayedVehicles.find((v) => v.id.includes("1042"));
    const headwaySource = map.getSource("headway-connector") as maplibregl.GeoJSONSource | undefined;

    const isHeadwayVisible =
      layers.headway &&
      visibleRouteIds.includes("м3") &&
      trailingVeh &&
      leadingVeh;

    if (isHeadwayVisible && trailingVeh && leadingVeh) {
      const isCritical =
        timeStep === "+15 мин"
          ? !isHoldingApplied
          : !isHoldingApplied && (trailingVeh.status === "BUNCHING_RISK" || leadingVeh.status === "BUNCHING_RISK");
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

      let intervalText = isHoldingApplied
        ? "Δ 3.5 мин • Выравнивание (Holding активен)"
        : "Δ 1.4 мин • Схлопывание (Пачкование)";
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
      el.title = "Нажмите для фокусировки и управления инцидентом в Инспекторе";
      el.onclick = () => {
        if (trailingVeh) {
          onSelectVehicleRef.current(trailingVeh.id);
        }
      };
      el.innerHTML = `
        <div style="
          background: ${isCritical ? "#dc2626" : "#059669"};
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 3px 9px;
          border-radius: 9999px;
          border: 1.5px solid #ffffff;
          box-shadow: 0 2px 12px ${isCritical ? "rgba(220, 38, 38, 0.55)" : "rgba(5, 150, 105, 0.45)"};
          white-space: nowrap;
          cursor: pointer;
          transition: transform 0.15s ease;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
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
  }, [
    displayedVehicles,
    selectedVehicleId,
    isDarkMode,
    timeStep,
    isHoldingApplied,
    visibleRouteIds,
    layers.vehicles,
    layers.headway,
    routes,
    dataMode,
    datasetLoadError,
    mapStyleRevision,
  ]);

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

  // Route layer & Congestion visibility + Alert & Selection highlighting toggle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const alertedRouteNormId = alert?.routeId ? normalizeRouteId(alert.routeId) : null;
    const activeRouteNormId = selectedRouteId || alertedRouteNormId;
    const hasActiveRoute = activeRouteNormId !== null;

    routes.forEach((r) => {
      const normId = normalizeRouteId(r.routeId);
      const srcId = `route-${normId}`;
      const isVis = layers.routes && visibleRouteIds.includes(normId);
      const vis = isVis ? "visible" : "none";
      const isActive = hasActiveRoute && normId === activeRouteNormId;
      const isAlerted = alertedRouteNormId !== null && normId === alertedRouteNormId;

      const casingWidth = isActive ? 12 : hasActiveRoute ? 4.5 : 6;
      const casingColor = isAlerted
        ? (alert?.category === "bunching" || alert?.tagType === "bunching" ? "#ef4444" : "#f59e0b")
        : isActive
        ? (isDarkMode ? "#ffffff" : "#0f172a")
        : (isDarkMode ? "#09090b" : "#ffffff");
      const casingOpacity = isActive ? 0.95 : hasActiveRoute ? 0.15 : 0.65;
      const casingBlur = isActive ? 2.0 : 0;

      const lineWidth = isActive ? 6.5 : hasActiveRoute ? 2.8 : 3.8;
      const lineOpacity = isActive ? 1.0 : hasActiveRoute ? 0.35 : 0.90;

      const casingLayer = `${srcId}-casing`;
      const lineLayer = `${srcId}-line`;

      try {
        if (map.getLayer(casingLayer)) {
          map.setLayoutProperty(casingLayer, "visibility", vis);
          map.setPaintProperty(casingLayer, "line-color", casingColor);
          map.setPaintProperty(casingLayer, "line-width", casingWidth);
          map.setPaintProperty(casingLayer, "line-opacity", casingOpacity);
          map.setPaintProperty(casingLayer, "line-blur", casingBlur);
        }
        if (map.getLayer(lineLayer)) {
          map.setLayoutProperty(lineLayer, "visibility", vis);
          map.setPaintProperty(lineLayer, "line-color", r.color);
          map.setPaintProperty(lineLayer, "line-width", lineWidth);
          map.setPaintProperty(lineLayer, "line-opacity", lineOpacity);
        }
      } catch {
        /* Ignore if map is updating styles */
      }
    });

    // Z-Order: Bring active route layers to the very top so no overlapping route can obscure it
    if (activeRouteNormId) {
      const activeSrc = `route-${activeRouteNormId}`;
      try {
        if (map.getLayer(`${activeSrc}-casing`)) map.moveLayer(`${activeSrc}-casing`);
        if (map.getLayer(`${activeSrc}-line`)) map.moveLayer(`${activeSrc}-line`);
      } catch {
        /* */
      }
    }

    const congVis = layers.congestion ? "visible" : "none";
    [
      "congestion-amber-fill",
      "congestion-amber-line",
      "congestion-red-fill",
      "congestion-red-line",
      "headway-connector-line",
    ].forEach((layerId) => {
      try {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", congVis);
          map.moveLayer(layerId);
        }
      } catch {
        /* */
      }
    });
  }, [visibleRouteIds, routes, layers.routes, layers.congestion, alert, isDarkMode, selectedRouteId]);

  // Dynamically update Congestion / Risk Zones GeoJSON based on active state and visible routes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource("congestion-zones") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (!layers.congestion || (dataMode === "dataset" && !datasetLoadError)) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const features: GeoJSON.Feature[] = [];

    // M3 Congestion Corridor: ONLY when M3 is visible AND Holding is NOT applied!
    // Once Holding is applied, the incident is mitigated and the risk corridor is cleared!
    if (!isHoldingApplied && visibleRouteIds.includes("м3")) {
      const primaryRoute = routes.find((r) => normalizeRouteId(r.routeId) === "м3");
      const segM3 = primaryRoute?.congestionSegment || [
        [37.6791, 55.7724],
        [37.697, 55.7785],
        [37.7082, 55.7818],
      ];
      const buf = 0.0018;
      const amberCoordsM3 = [
        [segM3[0][0] - buf, segM3[0][1] - buf * 0.4],
        [segM3[0][0] - buf * 0.5, segM3[0][1] + buf * 0.6],
        [segM3[segM3.length - 1][0] + buf, segM3[segM3.length - 1][1] + buf * 0.4],
        [segM3[segM3.length - 1][0] + buf * 0.5, segM3[segM3.length - 1][1] - buf * 0.6],
        [segM3[0][0] - buf, segM3[0][1] - buf * 0.4],
      ];
      const redCoordsM3 = [
        [segM3[0][0] - buf * 0.5, segM3[0][1] - buf * 0.2],
        [segM3[0][0] - buf * 0.2, segM3[0][1] + buf * 0.3],
        [segM3[segM3.length - 1][0] + buf * 0.5, segM3[segM3.length - 1][1] + buf * 0.2],
        [segM3[segM3.length - 1][0] + buf * 0.2, segM3[segM3.length - 1][1] - buf * 0.3],
        [segM3[0][0] - buf * 0.5, segM3[0][1] - buf * 0.2],
      ];

      features.push(
        {
          type: "Feature",
          properties: { level: "amber", title: "Замедление Бауманская — Электрозаводская" },
          geometry: { type: "Polygon", coordinates: [amberCoordsM3] },
        },
        {
          type: "Feature",
          properties: { level: "red", title: "Критическая зона пачкования м3" },
          geometry: { type: "Polygon", coordinates: [redCoordsM3] },
        }
      );
    }

    // M7 Congestion Zone: ONLY when M7 is visible and M7 alert is not mitigated
    const isM7Mitigated = alert?.id === "alert_2198" ? isHoldingApplied : false;
    if (!isM7Mitigated && visibleRouteIds.includes("м7")) {
      const amberCoordsM7 = [
        [37.653, 55.753],
        [37.655, 55.756],
        [37.671, 55.748],
        [37.669, 55.745],
        [37.653, 55.753],
      ];
      features.push({
        type: "Feature",
        properties: { level: "amber", title: "Затор Николоямская — Таганская" },
        geometry: { type: "Polygon", coordinates: [amberCoordsM7] },
      });
    }

    source.setData({
      type: "FeatureCollection",
      features,
    });
  }, [isHoldingApplied, visibleRouteIds, layers.congestion, dataMode, datasetLoadError, routes, alert]);

  // Quick camera presets & route focus
  const handleFocusRoute = (routeId: string) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const norm = normalizeRouteId(routeId);
    setSelectedRouteId(norm);

    const r = routes.find((x) => normalizeRouteId(x.routeId) === norm);
    if (r && r.routeGeometry.length > 0) {
      const bounds = r.routeGeometry.reduce(
        (b, coord) => b.extend(coord),
        new maplibregl.LngLatBounds(r.routeGeometry[0], r.routeGeometry[0])
      );
      map.fitBounds(bounds, { padding: 80, duration: 1000 });
      if (!visibleRouteIds.includes(norm)) {
        setVisibleRouteIds((prev) => [...prev, norm]);
      }
    }
  };

  const handleSelectRoute = (routeId: string) => {
    const norm = normalizeRouteId(routeId);
    if (selectedRouteId === norm) {
      setSelectedRouteId(null);
      handleFocusNetwork();
    } else {
      handleFocusRoute(norm);
    }
  };

  const handleFocusNetwork = () => {
    setSelectedRouteId(null);
    mapInstanceRef.current?.flyTo({
      center: [37.675, 55.765],
      zoom: 12.2,
      pitch: 0,
      duration: 1000,
    });
  };

  // Solo route display
  const handleSoloRoute = (routeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (visibleRouteIds.length === 1 && visibleRouteIds[0] === routeId) {
      // Toggle back to all
      setVisibleRouteIds(routes.map((r) => normalizeRouteId(r.routeId)));
    } else {
      setVisibleRouteIds([routeId]);
      handleFocusRoute(routeId);
    }
  };

  const handleToggleAllRoutes = () => {
    if (visibleRouteIds.length === routes.length) {
      setVisibleRouteIds([]);
    } else {
      setVisibleRouteIds(routes.map((r) => normalizeRouteId(r.routeId)));
    }
  };

  const riskRouteIds = useMemo(() => {
    const risky = new Set<string>();
    vehicles.forEach((v) => {
      if (v.status === "BUNCHING_RISK" || v.status === "DELAYED") {
        risky.add(normalizeRouteId(v.routeId));
      }
    });
    if (alert?.routeId) {
      risky.add(normalizeRouteId(alert.routeId));
    }
    if (risky.size === 0) {
      ["м3", "м7", "т88"].forEach((id) => {
        if (routes.some((r) => normalizeRouteId(r.routeId) === id)) {
          risky.add(id);
        }
      });
    }
    return Array.from(risky);
  }, [vehicles, alert, routes]);

  const filteredRoutes = useMemo(() => {
    if (!routeSearch.trim()) return routes;
    const q = routeSearch.trim().toLowerCase();
    return routes.filter((r) => {
      const normId = normalizeRouteId(r.routeId).toLowerCase();
      const name = (r.name || "").toLowerCase();
      return normId.includes(q) || name.includes(q);
    });
  }, [routes, routeSearch]);

  const handleFilterRisksOnly = () => {
    if (riskRouteIds.length > 0) {
      setVisibleRouteIds(riskRouteIds);
    } else {
      setVisibleRouteIds(["м3", "м7", "т88"].filter((id) => routes.some((r) => normalizeRouteId(r.routeId) === id)));
    }
  };

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden select-none">
      {/* 1. MapLibre GL Map Viewport */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* 2. Top Situational HUD Bar: Sleek Unified Navigation & Live Status */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center">
        <div
          className={`flex items-center gap-1.5 p-1 rounded-xl border backdrop-blur-xl shadow-2xl transition-all ${
            isDarkMode
              ? "border-white/10 bg-[#141416]/90 text-zinc-200 shadow-black/40"
              : "border-zinc-200/90 bg-white/95 text-zinc-800 shadow-zinc-400/25"
          }`}
        >
          {/* Active Status Badge */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-500/10 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isGpsMode
                  ? "bg-sky-400 animate-pulse"
                  : isHoldingApplied
                  ? "bg-emerald-400"
                  : "bg-rose-500 animate-pulse"
              }`}
            />
            <span className="font-mono font-semibold">
              {isGpsMode ? (
                `GPS: ${displayedVehicles.length} ТС`
              ) : isHoldingApplied ? (
                <span className="text-emerald-500 dark:text-emerald-400 font-bold">Такт в норме</span>
              ) : (
                <span className="text-rose-500 dark:text-rose-400 font-bold">Риск пачкования</span>
              )}
            </span>
            <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[11px]">
              {displayedVehicles.length} ТС
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-300 dark:bg-white/10 mx-0.5" />

          {/* Quick Route Focus Chips */}
          <div className="flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={handleFocusNetwork}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                !selectedRouteId
                  ? isDarkMode
                    ? "bg-white/15 text-white shadow-xs"
                    : "bg-zinc-200 text-zinc-900 shadow-xs"
                  : isDarkMode
                  ? "hover:bg-white/10 text-zinc-300 hover:text-white"
                  : "hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900"
              }`}
              title="Обзор всей маршрутной сети"
            >
              <Layers size={13} className="text-zinc-400" />
              <span>Сеть</span>
            </button>

            {routes.map((r) => {
              const normId = normalizeRouteId(r.routeId);
              const isSelected = activeRouteNormId === normId;
              const hasAlert =
                (alert?.routeId && normalizeRouteId(alert.routeId) === normId) ||
                vehicles.some(
                  (v) =>
                    normalizeRouteId(v.routeId) === normId &&
                    (v.status === "BUNCHING_RISK" || v.status === "DELAYED")
                );

              const stopName =
                r.stops && r.stops.length > 0
                  ? r.stops[Math.floor(r.stops.length / 2)]?.name
                      .replace(/^м\.\s*|^Метро\s*«?/i, "")
                      .replace(/»$/, "")
                  : "";

              return (
                <button
                  key={normId}
                  onClick={() => handleSelectRoute(normId)}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? isDarkMode
                        ? "bg-white/15 text-white border-white/20 shadow-xs"
                        : "bg-zinc-100 text-zinc-900 border-zinc-300 shadow-xs"
                      : isDarkMode
                      ? "border-transparent hover:bg-white/5 text-zinc-300 hover:text-white"
                      : "border-transparent hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900"
                  }`}
                  title={`Маршрут ${normId} (${r.name || stopName})`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: r.color }}
                  />
                  <span>{normId}</span>
                  {stopName && (
                    <span className="text-[10px] text-zinc-400 font-normal hidden sm:inline max-w-[85px] truncate">
                      {stopName}
                    </span>
                  )}
                  {hasAlert && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0"
                      title="Активный риск на маршруте"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Floating Map Tools (Right side of left panel) */}
      <div
        className={`absolute top-5 left-[365px] z-20 flex flex-col gap-1 p-1.5 rounded-xl border shadow-xl pointer-events-auto backdrop-blur-xl transition-all ${
          isDarkMode
            ? "border-white/10 bg-[#18181b]/95 text-zinc-200 shadow-black/25"
            : "border-zinc-200 bg-white/95 text-zinc-700 shadow-zinc-300/40"
        }`}
      >
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          title="Приблизить"
        >
          <Plus size={15} />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          title="Отдалить"
        >
          <Minus size={15} />
        </button>
        <div className="h-px my-0.5 bg-zinc-200 dark:bg-zinc-700" />
        <button
          onClick={() =>
            mapInstanceRef.current?.flyTo({
              center: [37.684, 55.772],
              zoom: 13,
              duration: 1000,
            })
          }
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
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
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          title="Переключить перспективу 2D/2.5D"
        >
          <Layers size={14} />
        </button>
        <button
          onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            isLayerMenuOpen
              ? "bg-sky-500/20 text-sky-600 dark:text-sky-300"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          }`}
          title="Слои отображения карты"
        >
          <Navigation size={13} />
        </button>
      </div>

      {/* Layer Visibility Menu */}
      {isLayerMenuOpen && (
        <div className="absolute top-5 left-[415px] z-20 pointer-events-auto">
          <div
            className={`rounded-xl border backdrop-blur-xl shadow-2xl p-2 min-w-[160px] flex flex-col gap-1 text-xs ${
              isDarkMode
                ? "border-white/10 bg-[#18181b]/95 text-zinc-200"
                : "border-zinc-200 bg-white/95 text-zinc-800 shadow-zinc-300/50"
            }`}
          >
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 py-0.5">
              Слои карты
            </div>
            <button
              onClick={() => setLayers((p) => ({ ...p, vehicles: !p.vehicles }))}
              className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Bus size={13} className="text-emerald-500" /> Борта (ТС)
              </span>
              <span className="text-[10px] font-bold text-zinc-500">
                {layers.vehicles ? "Вкл" : "Откл"}
              </span>
            </button>
            <button
              onClick={() => setLayers((p) => ({ ...p, stops: !p.stops }))}
              className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <MapPin size={13} className="text-sky-500" /> Остановки
              </span>
              <span className="text-[10px] font-bold text-zinc-500">
                {layers.stops ? "Вкл" : "Откл"}
              </span>
            </button>
            <button
              onClick={() => setLayers((p) => ({ ...p, congestion: !p.congestion }))}
              className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Flame size={13} className="text-amber-500" /> Зоны заторов
              </span>
              <span className="text-[10px] font-bold text-zinc-500">
                {layers.congestion ? "Вкл" : "Откл"}
              </span>
            </button>
            <button
              onClick={() => setLayers((p) => ({ ...p, headway: !p.headway }))}
              className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Activity size={13} className="text-rose-500" /> Интервалы
              </span>
              <span className="text-[10px] font-bold text-zinc-500">
                {layers.headway ? "Вкл" : "Откл"}
              </span>
            </button>
            <button
              onClick={() => setLayers((p) => ({ ...p, routes: !p.routes }))}
              className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Route size={13} className="text-indigo-500" /> Трассы линий
              </span>
              <span className="text-[10px] font-bold text-zinc-500">
                {layers.routes ? "Вкл" : "Откл"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Route Filter Panel */}
      <div className="absolute top-[205px] left-[365px] z-20 pointer-events-auto">
        {isRoutesCollapsed ? (
          <button
            onClick={() => setIsRoutesCollapsed(false)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border backdrop-blur-xl shadow-md transition-all cursor-pointer group outline-none focus:outline-none ${
              alert?.routeId
                ? isDarkMode
                  ? "border-rose-500/50 bg-rose-950/80 text-rose-200 shadow-rose-900/30"
                  : "border-rose-300 bg-rose-50 text-rose-800 shadow-rose-200/40"
                : isDarkMode
                ? "border-white/10 bg-[#18181b]/95 text-zinc-200 hover:bg-[#27272a] shadow-black/30"
                : "border-zinc-200 bg-white/95 text-zinc-800 hover:bg-zinc-50 shadow-zinc-300/40"
            }`}
            title="Развернуть фильтр маршрутов"
          >
            <Route size={11} className={alert?.routeId ? "text-rose-500 shrink-0" : "text-sky-500 shrink-0"} />
            <span className="font-bold text-[9.5px] uppercase tracking-wider">Маршруты</span>
            {alert?.routeId && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
            )}
            <span
              className={`text-[8.5px] px-1 py-0.2 rounded font-mono font-bold ${
                visibleRouteIds.length === 0
                  ? isDarkMode ? "bg-rose-950/60 text-rose-300" : "bg-rose-50 text-rose-600 border border-rose-200"
                  : isDarkMode ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-700 border border-zinc-200"
              }`}
            >
              {visibleRouteIds.length}/{routes.length}
            </span>
            <ChevronDown size={11} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200" />
          </button>
        ) : (
          <div
            className={`rounded-xl border backdrop-blur-xl shadow-xl w-[146px] p-1.5 transition-all flex flex-col ${
              isDarkMode
                ? "border-white/10 bg-[#18181b]/95 text-zinc-100 shadow-black/30"
                : "border-zinc-200 bg-white/95 text-zinc-800 shadow-zinc-300/40"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-zinc-200/70 dark:border-white/10">
              <div className="flex items-center gap-1 min-w-0">
                <Route size={11} className={alert?.routeId ? "text-rose-500 shrink-0" : "text-sky-500 shrink-0"} />
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Маршруты
                </span>
                <span
                  className={`text-[8.5px] px-1 py-0.2 rounded font-mono font-bold ${
                    visibleRouteIds.length === 0
                      ? isDarkMode ? "bg-rose-950/60 text-rose-300" : "bg-rose-50 text-rose-600 border border-rose-200"
                      : isDarkMode ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                  }`}
                >
                  {visibleRouteIds.length}/{routes.length}
                </span>
              </div>

              <button
                onClick={() => setIsRoutesCollapsed(true)}
                className={`p-0.5 rounded transition-colors cursor-pointer outline-none focus:outline-none ${
                  isDarkMode
                    ? "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
                title="Свернуть панель маршрутов"
              >
                <ChevronUp size={11} />
              </button>
            </div>

            {/* Quick Actions Micro Toolbar */}
            <div className="flex items-center justify-between gap-1 mb-1">
              <button
                onClick={handleToggleAllRoutes}
                className={`flex-1 py-0.5 px-1 rounded text-[8.5px] font-semibold transition-all text-center cursor-pointer outline-none focus:outline-none ${
                  isDarkMode
                    ? "bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200"
                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-800"
                }`}
                title={visibleRouteIds.length === routes.length ? "Скрыть все маршруты" : "Показать все маршруты"}
              >
                {visibleRouteIds.length === routes.length ? "Снять" : "Все"}
              </button>

              <button
                onClick={handleFilterRisksOnly}
                className={`flex-1 py-0.5 px-1 rounded text-[8.5px] font-semibold transition-all text-center cursor-pointer outline-none focus:outline-none ${
                  isDarkMode
                    ? "bg-rose-950/60 text-rose-300 hover:bg-rose-900/80"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                }`}
                title="Показать только проблемные маршруты"
              >
                Риски{riskRouteIds.length > 0 ? ` (${riskRouteIds.length})` : ""}
              </button>
            </div>

            {/* Search filter only when routes > 8 */}
            {routes.length > 8 && (
              <div className="relative mb-1">
                <Search
                  size={10}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={routeSearch}
                  onChange={(e) => setRouteSearch(e.target.value)}
                  placeholder="Поиск..."
                  className={`w-full pl-5 pr-4 py-0.5 rounded text-[9.5px] outline-none transition-all ${
                    isDarkMode
                      ? "bg-zinc-900/90 border border-white/10 text-zinc-200 placeholder:text-zinc-500 focus:border-sky-500"
                      : "bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-sky-500"
                  }`}
                />
                {routeSearch && (
                  <button
                    onClick={() => setRouteSearch("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer outline-none focus:outline-none"
                  >
                    <X size={9} />
                  </button>
                )}
              </div>
            )}

            {/* Scrollable list of routes with tight height */}
            <div className="flex flex-col gap-0.5 max-h-[145px] overflow-y-auto pr-0.5">
              {filteredRoutes.length === 0 ? (
                <div className="text-center py-1.5 text-[9px] text-zinc-400">Маршруты не найдены</div>
              ) : (
                filteredRoutes.map((r) => {
                  const normId = normalizeRouteId(r.routeId);
                  const count = vehicles.filter(
                    (v) => normalizeRouteId(v.routeId) === normId
                  ).length;
                  const isVis = visibleRouteIds.includes(normId);
                  const isSelected = activeRouteNormId === normId;
                  const isAlertedRoute = alert?.routeId && normalizeRouteId(alert.routeId) === normId;

                  return (
                    <div
                      key={normId}
                      title={r.name ? `${normId}: ${r.name}` : normId}
                      onClick={() => handleSelectRoute(normId)}
                      className={`group flex items-center justify-between px-1.5 py-0.5 rounded text-left transition-all cursor-pointer select-none border ${
                        isSelected
                          ? isDarkMode
                            ? "bg-white/10 border-white/20 text-white shadow-xs"
                            : "bg-zinc-100 border-zinc-300 text-zinc-900 shadow-xs"
                          : isVis
                          ? isDarkMode
                            ? "border-transparent text-zinc-100 hover:bg-zinc-800/80"
                            : "border-transparent text-zinc-900 hover:bg-zinc-100"
                          : isDarkMode
                          ? "border-transparent text-zinc-500 hover:bg-zinc-800/40 opacity-40"
                          : "border-transparent text-zinc-400 hover:bg-zinc-100/60 opacity-45"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Always display authentic route color swatch */}
                        <span
                          style={{
                            backgroundColor: r.color,
                            width: 8,
                            height: 4,
                            borderRadius: 2,
                            opacity: isVis ? 1 : 0.35,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          className={`text-[10.5px] font-semibold tracking-tight truncate ${
                            isSelected
                              ? "font-bold text-white"
                              : isVis
                              ? isDarkMode
                                ? "text-zinc-100"
                                : "text-zinc-900"
                              : isDarkMode
                              ? "text-zinc-500"
                              : "text-zinc-400"
                          }`}
                        >
                          {normId}
                        </span>
                        {isAlertedRoute && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0"
                            title="Активный риск по маршруту"
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-[9.5px] font-mono ${
                            isDarkMode ? "text-zinc-400" : "text-zinc-500"
                          }`}
                        >
                          {count} ТС
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVisibleRouteIds((prev) =>
                              prev.includes(normId)
                                ? prev.filter((id) => id !== normId)
                                : [...prev, normId]
                            );
                          }}
                          className={`p-0.5 rounded transition-all cursor-pointer outline-none focus:outline-none ${
                            isVis
                              ? isDarkMode
                                ? "text-zinc-400 hover:text-white"
                                : "text-zinc-500 hover:text-zinc-900"
                              : "text-zinc-600 dark:text-zinc-600 opacity-40"
                          }`}
                          title={isVis ? "Скрыть маршрут" : "Показать маршрут"}
                        >
                          {isVis ? <Eye size={10} /> : <EyeOff size={10} />}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Floating Bottom Center Horizon Scrubber Capsule */}
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
                ? isDarkMode
                  ? "bg-zinc-700 text-white"
                  : "bg-zinc-800 text-white"
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
        <div
          className={`text-[9px] text-center font-medium ${
            isDarkMode ? "text-zinc-500" : "text-zinc-400"
          }`}
        >
          {isTileServerAvailable
            ? "Автономная векторная карта Москвы (TileServer GL • Planetiler) • СППР Мосгортранс"
            : "Резервная карта CartoDB Positron (TileServer GL offline) • СППР Мосгортранс"}
        </div>
      </div>
    </div>
  );
};

export default MapView;
