import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
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
import { Vehicle, AlertItem, RouteData } from "../mock/telemetry";

// Reliable GIS Canvas tiles (No API Key Required, crystal-clear situational view)
const ESRI_LIGHT_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const ESRI_DARK_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
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
  camera,
  isDarkMode,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesLayerRef = useRef<L.LayerGroup | null>(null);
  const polygonsLayerRef = useRef<L.LayerGroup | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const isHoldingApplied = alert?.recommendation?.applied ?? false;

  // 1. Calculate projected vehicle positions across timeline horizons
  const displayedVehicles = useMemo(() => {
    if (timeStep === "Сейчас") {
      return vehicles;
    }

    return vehicles.map((veh) => {
      const is1042 = veh.id.includes("1042");
      const is1043 = veh.id.includes("1043");

      if (timeStep === "+15 мин") {
        if (is1042) {
          return {
            ...veh,
            latitude: 55.7808,
            longitude: 37.7085,
            speedKmh: 16,
            currentStop: "Бакунинская ул., 84",
            nextStop: "м. Электрозаводская",
          };
        }
        if (is1043) {
          if (isHoldingApplied) {
            return {
              ...veh,
              latitude: 55.7750,
              longitude: 37.6860,
              speedKmh: 26,
              status: "NORMAL" as const,
              currentStop: "м. Бауманская (Holding отработан)",
              nextStop: "Бакунинская ул.",
            };
          } else {
            return {
              ...veh,
              latitude: 55.7801,
              longitude: 37.7055, // caught up! bunching
              speedKmh: 12,
              status: "BUNCHING_RISK" as const,
              currentStop: "Бакунинская ул.",
              nextStop: "м. Электрозаводская",
            };
          }
        }
      } else if (timeStep === "+30 мин") {
        if (is1042) {
          return {
            ...veh,
            latitude: 55.7845,
            longitude: 37.7225,
            speedKmh: 28,
            currentStop: "м. Электрозаводская",
            nextStop: "м. Семёновская",
          };
        }
        if (is1043) {
          return {
            ...veh,
            latitude: isHoldingApplied ? 55.7798 : 55.7838,
            longitude: isHoldingApplied ? 37.7040 : 37.7205,
            speedKmh: isHoldingApplied ? 29 : 14,
            status: isHoldingApplied ? ("NORMAL" as const) : ("BUNCHING_RISK" as const),
            currentStop: isHoldingApplied ? "Бакунинская ул." : "м. Электрозаводская",
            nextStop: isHoldingApplied ? "м. Электрозаводская" : "м. Семёновская",
          };
        }
      } else if (timeStep === "+45 мин") {
        if (is1042) {
          return {
            ...veh,
            latitude: 55.7890,
            longitude: 37.7340,
            speedKmh: 22,
            currentStop: "м. Семёновская (Конечная)",
            nextStop: "Разворотное кольцо",
          };
        }
        if (is1043) {
          return {
            ...veh,
            latitude: isHoldingApplied ? 55.7848 : 55.7882,
            longitude: isHoldingApplied ? 37.7230 : 37.7315,
            speedKmh: 25,
            status: isHoldingApplied ? ("NORMAL" as const) : ("BUNCHING_RISK" as const),
            currentStop: isHoldingApplied ? "м. Электрозаводская" : "м. Семёновская",
            nextStop: "м. Семёновская",
          };
        }
      }
      return veh;
    });
  }, [vehicles, timeStep, isHoldingApplied]);

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

  // 3. Initialize Leaflet Map with ESRI Canvas (Light Gray / Dark Gray)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = [55.7745, 37.6850];
    const initialZoom = 13;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
    });

    const tileUrl = isDarkMode ? ESRI_DARK_TILES : ESRI_LIGHT_TILES;

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 18,
      attribution: "© OpenStreetMap, Esri, Мосгортранс",
    }).addTo(map);

    polygonsLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    stopsLayerRef.current = L.layerGroup().addTo(map);
    vehiclesLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Invalidate size to guarantee full canvas rendering
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => map.invalidateSize();
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update tilelayer on isDarkMode toggle
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const newTileUrl = isDarkMode ? ESRI_DARK_TILES : ESRI_LIGHT_TILES;
    tileLayerRef.current.setUrl(newTileUrl);
  }, [isDarkMode]);

  // 4. Draw Route Polylines, Congestion Polygons, and Stop Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !routeLayerRef.current || !stopsLayerRef.current || !polygonsLayerRef.current) return;

    routeLayerRef.current.clearLayers();
    stopsLayerRef.current.clearLayers();
    polygonsLayerRef.current.clearLayers();

    // Congestion Polygons (Amber & Red over Basmanny corridor)
    const amberPolygonCoords: [number, number][] = [
      [55.7680, 37.6650],
      [55.7760, 37.6750],
      [55.7820, 37.7100],
      [55.7730, 37.7020],
    ];

    const redCongestionCoords: [number, number][] = [
      [55.7710, 37.6740],
      [55.7765, 37.6890],
      [55.7795, 37.7050],
      [55.7740, 37.6980],
    ];

    L.polygon(amberPolygonCoords, {
      color: "#d97706",
      fillColor: "#fbbf24",
      fillOpacity: isDarkMode ? 0.22 : 0.16,
      weight: 1.5,
      dashArray: "4 4",
    }).addTo(polygonsLayerRef.current);

    L.polygon(redCongestionCoords, {
      color: "#dc2626",
      fillColor: "#ef4444",
      fillOpacity: isDarkMode ? 0.28 : 0.2,
      weight: 1.5,
      dashArray: "3 3",
    }).addTo(polygonsLayerRef.current);

    // Primary Route m3 Polyline (Emerald Green #00875A / Neon Emerald)
    const m3Coordinates: [number, number][] = [
      [55.7580, 37.6420],
      [55.7645, 37.6610],
      [55.7724, 37.6791], // м. Бауманская
      [55.7785, 37.6970], // Бакунинская
      [55.7831, 37.7189], // м. Электрозаводская
      [55.7890, 37.7340], // м. Семёновская
    ];

    L.polyline(m3Coordinates, {
      color: isDarkMode ? "#10b981" : "#00875A",
      weight: 5,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(routeLayerRef.current);

    // Stop Points
    const stopsList = [
      { name: "ул. Покровка", coords: [55.7645, 37.6610] as [number, number] },
      { name: "м. Бауманская", coords: [55.7724, 37.6791] as [number, number] },
      { name: "Бакунинская ул.", coords: [55.7785, 37.6970] as [number, number] },
      { name: "м. Электрозаводская", coords: [55.7831, 37.7189] as [number, number] },
      { name: "м. Семёновская", coords: [55.7890, 37.7340] as [number, number] },
    ];

    stopsList.forEach((stop) => {
      const stopIcon = L.divIcon({
        className: "stop-icon",
        html: `
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            background: ${isDarkMode ? "#18181b" : "#ffffff"};
            border: 2px solid ${isDarkMode ? "#10b981" : "#00875A"};
            border-radius: 6px;
            padding: 2px 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,${isDarkMode ? "0.4" : "0.15"});
            font-size: 10px;
            font-weight: 700;
            color: ${isDarkMode ? "#f4f4f5" : "#18181b"};
            white-space: nowrap;
            transform: translate(-50%, -100%);
          ">
            <span style="width: 5px; height: 5px; border-radius: 50%; background: ${isDarkMode ? "#10b981" : "#00875A"};"></span>
            <span>${stop.name}</span>
          </div>
        `,
        iconSize: [90, 22],
        iconAnchor: [45, 11],
      });

      L.marker(stop.coords, { icon: stopIcon }).addTo(stopsLayerRef.current!);
    });
  }, [route, isDarkMode]);

  // 5. Draw Vehicle Markers dynamically from displayedVehicles
  useEffect(() => {
    if (!vehiclesLayerRef.current) return;
    vehiclesLayerRef.current.clearLayers();

    displayedVehicles.forEach((veh) => {
      const isSelected = veh.id === selectedVehicleId;
      const isBunching = veh.status === "BUNCHING_RISK";
      const isDelayed = veh.status === "DELAYED";
      const cleanId = veh.id.replace(/^P/, "");

      // Dynamic color theme
      const badgeBg = isBunching ? "#dc2626" : isDelayed ? "#d97706" : "#00875A";
      const statusText = isBunching
        ? `№${cleanId} • Пачкование ${veh.speedKmh} км/ч`
        : isDelayed
        ? `№${cleanId} • +${Math.round(veh.delaySeconds / 60)}м (${veh.speedKmh} км/ч)`
        : `№${cleanId} • ${veh.speedKmh} км/ч`;

      const vehicleIcon = L.divIcon({
        className: `bus-marker-${veh.id}`,
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%); cursor: pointer;">
            ${(isBunching || isSelected) ? `
              <div style="
                position: absolute;
                width: ${isSelected ? "52px" : "44px"};
                height: ${isSelected ? "52px" : "44px"};
                border-radius: 50%;
                background: ${isBunching ? "rgba(239, 68, 68, 0.3)" : "rgba(37, 99, 235, 0.35)"};
                animation: pulse-ring 2s infinite;
              "></div>
            ` : ""}
            
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
              box-shadow: 0 4px 14px ${isBunching ? "rgba(220, 38, 38, 0.45)" : "rgba(0, 135, 90, 0.4)"};
              border: 2px solid ${isSelected ? "#38bdf8" : "#ffffff"};
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
              border: 2px solid ${isSelected ? "#38bdf8" : "#ffffff"};
              margin-top: 2px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            ">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
            </div>
          </div>
        `,
        iconSize: [220, 48],
        iconAnchor: [110, 24],
      });

      const marker = L.marker([veh.latitude, veh.longitude], { icon: vehicleIcon });
      marker.on("click", () => onSelectVehicle(veh.id));
      vehiclesLayerRef.current?.addLayer(marker);
    });

    // 6. Headway Connector between trailing bus and leading bus
    const trailingVeh = displayedVehicles.find((v) => v.id.includes("1043"));
    const leadingVeh = displayedVehicles.find((v) => v.id.includes("1042"));

    if (trailingVeh && leadingVeh) {
      const isCritical =
        timeStep === "+15 мин"
          ? !isHoldingApplied
          : trailingVeh.status === "BUNCHING_RISK" || leadingVeh.status === "BUNCHING_RISK";
      const connectorColor = isCritical ? "#ef4444" : "#10b981";

      const connectorLine = L.polyline(
        [
          [trailingVeh.latitude, trailingVeh.longitude],
          [leadingVeh.latitude, leadingVeh.longitude],
        ],
        {
          color: connectorColor,
          weight: 3,
          dashArray: isCritical ? "5, 7" : "4, 6",
          opacity: 0.9,
        }
      );
      vehiclesLayerRef.current.addLayer(connectorLine);

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

      const headwayBadge = L.divIcon({
        className: "headway-badge",
        html: `
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
            transform: translate(-50%, -50%);
          ">
            ${intervalText}
          </div>
        `,
        iconSize: [200, 24],
        iconAnchor: [100, 12],
      });
      vehiclesLayerRef.current.addLayer(L.marker([midLat, midLon], { icon: headwayBadge }));
    }
  }, [displayedVehicles, selectedVehicleId, onSelectVehicle, isDarkMode, timeStep, isHoldingApplied]);

  // FlyTo handler
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && flyToTarget) {
      map.flyTo([flyToTarget.lat, flyToTarget.lon], flyToTarget.zoom || 14, {
        duration: 1.2,
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
      {/* 1. Leaflet Map Viewport */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* 2. Floating Map Tools (Right side of left panel) */}
      <div
        className="absolute top-5 left-[365px] z-20 flex flex-col gap-1 p-1.5 rounded-xl border border-zinc-700/80 bg-[#18181b]/95 text-zinc-200 shadow-xl shadow-black/25 pointer-events-auto backdrop-blur-xl transition-all"
      >
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-slate-800 text-slate-200"
          title="Приблизить"
        >
          <Plus size={15} />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-slate-800 text-slate-200"
          title="Отдалить"
        >
          <Minus size={15} />
        </button>
        <div className="h-px my-0.5 bg-slate-700" />
        <button
          onClick={() => mapInstanceRef.current?.flyTo([55.7745, 37.6850], 13)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-slate-800 text-slate-200"
          title="Центрировать на перегоне"
        >
          <Crosshair size={14} />
        </button>
        <button
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-slate-800 text-slate-200"
          title="Слои карты"
        >
          <Layers size={14} />
        </button>
      </div>

      {/* 3. Floating Bottom Center Horizon Scrubber Capsule */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center gap-1.5">
        {/* ML Horizon Mode Indicator Badge */}
        {timeStep === "+15 мин" ? (
          <div
            className={`px-3 py-1 rounded-full text-[11px] font-black flex items-center gap-1.5 shadow-lg border backdrop-blur-md transition-all ${
              isHoldingApplied
                ? "bg-emerald-600/95 text-white border-emerald-400"
                : "bg-red-600/95 text-white border-red-400 animate-pulse"
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
          <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow border backdrop-blur-md bg-[#18181b]/90 text-emerald-400 border-zinc-700">
            <Radio size={11} className="animate-pulse text-emerald-500" />
            <span>ОНЛАЙН ТЕЛЕМЕТРИЯ NDTP • ТЕКУЩИЙ МОМЕНТ</span>
          </div>
        ) : (
          <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow border backdrop-blur-md bg-[#18181b]/90 text-blue-400 border-zinc-700">
            <span>ПРОГНОЗНЫЙ ГОРИЗОНТ ДВИЖЕНИЯ {timeStep}</span>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-700/80 shadow-2xl shadow-black/35 px-4 py-2.5 flex items-center gap-3 w-[460px] max-w-[calc(100vw-750px)] backdrop-blur-xl bg-[#18181b]/95 text-zinc-200 transition-colors">
          {/* Play/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm shrink-0 cursor-pointer ${
              isPlaying
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : isDarkMode
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : "bg-slate-900 hover:bg-slate-800 text-white"
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
                ? "text-emerald-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="К текущему моменту (Сейчас)"
          >
            <SkipBack size={15} />
          </button>

          {/* Step Back */}
          <button
            onClick={handlePrevStep}
            className="text-slate-400 hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
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
                isDarkMode ? "bg-slate-700/80" : "bg-slate-200"
              }`}
            >
              <div
                className="h-full bg-[#00875A] rounded-full transition-all"
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
                className={`absolute w-3.5 h-3.5 rounded-full border-2 border-[#00875A] shadow-md transition-all ${
                  isDarkMode ? "bg-slate-900" : "bg-white"
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
                      ? "text-emerald-400 font-extrabold"
                      : "text-emerald-700 font-extrabold"
                    : isDarkMode
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Сейчас
              </button>

              <button
                onClick={() => onTimeStepChange("+15 мин")}
                className={`px-1.5 py-0.5 rounded cursor-pointer transition-all ${
                  timeStep === "+15 мин"
                    ? isDarkMode
                      ? "bg-amber-900/60 text-amber-300 font-extrabold border border-amber-600"
                      : "bg-amber-100 text-amber-900 font-extrabold border border-amber-300"
                    : isDarkMode
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-500 hover:text-slate-800"
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
                      : "text-slate-900 font-extrabold"
                    : isDarkMode
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-500 hover:text-slate-800"
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
                      : "text-slate-900 font-extrabold"
                    : isDarkMode
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                +45м
              </button>
            </div>
          </div>

          {/* Next Arrow */}
          <button
            onClick={handleNextStep}
            className="text-slate-400 hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
            title="Следующий горизонт"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Subtle source attribution */}
        <div className={`text-[9px] text-center font-medium ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          Esri Canvas GIS • Прогностический движок СППР Мосгортранс
        </div>
      </div>
    </div>
  );
};

export default MapView;
