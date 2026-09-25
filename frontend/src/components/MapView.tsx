import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  Play,
  Pause,
  SkipBack,
  ChevronRight,
  Plus,
  Minus,
  Layers,
  Crosshair,
  Maximize2,
} from "lucide-react";
import { Vehicle, AlertItem, RouteData } from "../mock/telemetry";

interface MapViewProps {
  route: RouteData;
  vehicles: Vehicle[];
  alert: AlertItem | null;
  selectedVehicleId: string;
  onSelectVehicle: (id: string) => void;
  flyToTarget: { lat: number; lon: number; zoom?: number } | null;
  timeStep: string;
  onTimeStepChange: (step: string) => void;
  camera?: {
    id: string;
    location: string;
    status: string;
    footerText: string;
  };
  isDarkMode?: boolean;
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
  isDarkMode = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesLayerRef = useRef<L.LayerGroup | null>(null);
  const polygonsLayerRef = useRef<L.LayerGroup | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // 1. Initialize Leaflet Map with CartoDB Positron / Dark Matter
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [55.7745, 37.6850], // Moscow: Baumanskaya corridor
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    const tileUrl = isDarkMode
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 20,
      subdomains: "abcd",
      attribution: "© OpenStreetMap / CartoDB / Мосгортранс",
    }).addTo(map);

    polygonsLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    stopsLayerRef.current = L.layerGroup().addTo(map);
    vehiclesLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update tilelayer on isDarkMode toggle
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const newTileUrl = isDarkMode
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    tileLayerRef.current.setUrl(newTileUrl);
  }, [isDarkMode]);

  // 2. Draw Route Polylines, Congestion Polygons, and Stop Markers
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
      fillOpacity: isDarkMode ? 0.25 : 0.18,
      weight: 1.5,
      dashArray: "4 4",
    }).addTo(polygonsLayerRef.current);

    L.polygon(redCongestionCoords, {
      color: "#dc2626",
      fillColor: "#ef4444",
      fillOpacity: isDarkMode ? 0.32 : 0.22,
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
      { name: "Электрозаводская", coords: [55.7831, 37.7189] as [number, number] },
    ];

    stopsList.forEach((stop) => {
      const stopIcon = L.divIcon({
        className: "stop-icon",
        html: `
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            background: ${isDarkMode ? "#1e293b" : "#ffffff"};
            border: 2px solid ${isDarkMode ? "#10b981" : "#00875A"};
            border-radius: 6px;
            padding: 2px 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,${isDarkMode ? "0.4" : "0.15"});
            font-size: 10px;
            font-weight: 700;
            color: ${isDarkMode ? "#f8fafc" : "#1e293b"};
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

  // 3. Draw Vehicle Markers dynamically from vehicles prop
  useEffect(() => {
    if (!vehiclesLayerRef.current) return;
    vehiclesLayerRef.current.clearLayers();

    vehicles.forEach((veh) => {
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
        : `№${cleanId} (Лидер) • ${veh.speedKmh} км/ч`;

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

    // 4. Headway Connector between trailing bus and leading bus
    const trailingVeh = vehicles.find((v) => v.status === "BUNCHING_RISK") || vehicles.find((v) => v.id.includes("1042"));
    const leadingVeh = vehicles.find((v) => v.id.includes("1043")) || vehicles.find((v) => v.status === "NORMAL" && v.id !== trailingVeh?.id);

    if (trailingVeh && leadingVeh) {
      const connectorLine = L.polyline(
        [
          [trailingVeh.latitude, trailingVeh.longitude],
          [leadingVeh.latitude, leadingVeh.longitude],
        ],
        {
          color: "#ef4444",
          weight: 2.5,
          dashArray: "5, 7",
          opacity: 0.85,
        }
      );
      vehiclesLayerRef.current.addLayer(connectorLine);

      // Midpoint interval tag
      const midLat = (trailingVeh.latitude + leadingVeh.latitude) / 2;
      const midLon = (trailingVeh.longitude + leadingVeh.longitude) / 2;
      const headwayBadge = L.divIcon({
        className: "headway-badge",
        html: `
          <div style="
            background: #dc2626;
            color: #ffffff;
            font-size: 10px;
            font-weight: 800;
            font-family: monospace;
            padding: 2px 8px;
            border-radius: 9999px;
            border: 1.5px solid #ffffff;
            box-shadow: 0 2px 10px rgba(220, 38, 38, 0.5);
            white-space: nowrap;
            transform: translate(-50%, -50%);
          ">
            Δ 1.4 мин • Схлопывание
          </div>
        `,
        iconSize: [140, 24],
        iconAnchor: [70, 12],
      });
      vehiclesLayerRef.current.addLayer(L.marker([midLat, midLon], { icon: headwayBadge }));
    }
  }, [vehicles, selectedVehicleId, onSelectVehicle, isDarkMode]);

  // FlyTo handler
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && flyToTarget) {
      map.flyTo([flyToTarget.lat, flyToTarget.lon], flyToTarget.zoom || 14, {
        duration: 1.2,
      });
    }
  }, [flyToTarget]);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden select-none">
      {/* 1. Leaflet Map Viewport */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* 2. Floating Map Tools (Right side of left panel) */}
      <div
        className={`absolute top-5 left-[365px] z-20 flex flex-col gap-1 p-1.5 rounded-xl border shadow-xl pointer-events-auto backdrop-blur-xl transition-colors ${
          isDarkMode
            ? "bg-[#151D2A]/90 border-slate-700/80 text-slate-200 shadow-black/40"
            : "bg-white/95 border-slate-200/90 text-slate-700 shadow-slate-900/10"
        }`}
      >
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            isDarkMode ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
          }`}
          title="Приблизить"
        >
          <Plus size={15} />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            isDarkMode ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
          }`}
          title="Отдалить"
        >
          <Minus size={15} />
        </button>
        <div className={`h-px my-0.5 ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`} />
        <button
          onClick={() => mapInstanceRef.current?.flyTo([55.7745, 37.6850], 13)}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            isDarkMode ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
          }`}
          title="Центрировать на перегоне"
        >
          <Crosshair size={14} />
        </button>
        <button
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            isDarkMode ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
          }`}
          title="Слои карты"
        >
          <Layers size={14} />
        </button>
      </div>

      {/* 3. Floating Bottom Center Horizon Scrubber Capsule */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div
          className={`rounded-full border shadow-2xl px-4 py-2 flex items-center gap-3 w-[420px] max-w-[calc(100vw-750px)] backdrop-blur-xl transition-colors ${
            isDarkMode
              ? "bg-[#151D2A]/90 border-slate-700/80 text-slate-200 shadow-black/50"
              : "bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-900/10"
          }`}
        >
          {/* Play/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-sm shrink-0 cursor-pointer ${
              isDarkMode ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-slate-900 hover:bg-slate-800 text-white"
            }`}
            title={isPlaying ? "Пауза" : "Воспроизведение"}
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
          </button>

          {/* Rewind */}
          <button
            onClick={() => onTimeStepChange("Сейчас")}
            className="text-slate-400 hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
            title="К текущему моменту"
          >
            <SkipBack size={13} />
          </button>

          {/* Time Steps and Track */}
          <div className="flex-1 flex flex-col gap-1 px-1">
            {/* Slider track with active thumb */}
            <div className={`relative w-full h-1.5 rounded-full flex items-center ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`}>
              <div
                className="h-full bg-[#00875A] rounded-full transition-all"
                style={{
                  width:
                    timeStep === "Сейчас"
                      ? "8%"
                      : timeStep === "+15 мин"
                      ? "45%"
                      : timeStep === "+30 мин"
                      ? "75%"
                      : "100%",
                }}
              />
              <div
                className={`absolute w-3 h-3 rounded-full border-2 border-[#00875A] shadow-md transition-all cursor-pointer ${
                  isDarkMode ? "bg-slate-900" : "bg-white"
                }`}
                style={{
                  left:
                    timeStep === "Сейчас"
                      ? "8%"
                      : timeStep === "+15 мин"
                      ? "45%"
                      : timeStep === "+30 мин"
                      ? "75%"
                      : "100%",
                  transform: "translateX(-50%)",
                }}
              />
            </div>

            {/* Step buttons row */}
            <div className="flex justify-between items-center text-[10px] font-semibold pt-0.5">
              <button
                onClick={() => onTimeStepChange("Сейчас")}
                className={`cursor-pointer transition-colors ${
                  timeStep === "Сейчас"
                    ? isDarkMode ? "text-white font-bold" : "text-slate-900 font-bold"
                    : isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Сейчас
              </button>

              <button
                onClick={() => onTimeStepChange("+15 мин")}
                className={`px-1.5 py-0.2 rounded-full cursor-pointer transition-all ${
                  timeStep === "+15 мин"
                    ? isDarkMode
                      ? "bg-emerald-900/60 text-emerald-300 font-extrabold border border-emerald-600"
                      : "bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-300"
                    : isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                +15м (ML)
              </button>

              <button
                onClick={() => onTimeStepChange("+30 мин")}
                className={`cursor-pointer transition-colors ${
                  timeStep === "+30 мин"
                    ? isDarkMode ? "text-white font-bold" : "text-slate-900 font-bold"
                    : isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                +30м
              </button>

              <button
                onClick={() => onTimeStepChange("+45 мин")}
                className={`cursor-pointer transition-colors ${
                  timeStep === "+45 мин"
                    ? isDarkMode ? "text-white font-bold" : "text-slate-900 font-bold"
                    : isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                +45м
              </button>
            </div>
          </div>

          {/* Next Arrow */}
          <button
            onClick={() => onTimeStepChange("+30 мин")}
            className="text-slate-400 hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
            title="Следующий горизонт"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Bottom subtle watermark note */}
        <div className={`text-[9px] text-center font-medium mt-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          {isDarkMode ? "CartoDB Dark Matter" : "CartoDB Positron"} • ЕГКС Мосгортранс
        </div>
      </div>
    </div>
  );
};

export default MapView;
