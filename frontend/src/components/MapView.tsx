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
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesLayerRef = useRef<L.LayerGroup | null>(null);
  const polygonsLayerRef = useRef<L.LayerGroup | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // 1. Initialize Leaflet Map with CartoDB Positron clean light tiles
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [55.7745, 37.6850], // Moscow: Baumanskaya corridor
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    // OpenStreetMap styled with clean light filter (CartoDB Positron look without watermark)
    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        className: "clean-light-tiles",
        attribution: "© OpenStreetMap / Мосгортранс",
      }
    ).addTo(map);

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
      fillOpacity: 0.18,
      weight: 1.5,
      dashArray: "4 4",
    }).addTo(polygonsLayerRef.current);

    L.polygon(redCongestionCoords, {
      color: "#dc2626",
      fillColor: "#ef4444",
      fillOpacity: 0.22,
      weight: 1.5,
      dashArray: "3 3",
    }).addTo(polygonsLayerRef.current);

    // Primary Route m3 Polyline (Emerald Green #00875A)
    const m3Coordinates: [number, number][] = [
      [55.7580, 37.6420],
      [55.7645, 37.6610],
      [55.7724, 37.6791], // м. Бауманская
      [55.7785, 37.6970], // Бакунинская
      [55.7831, 37.7189], // м. Электрозаводская
      [55.7890, 37.7340], // м. Семёновская
    ];

    L.polyline(m3Coordinates, {
      color: "#00875A",
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
            background: #ffffff;
            border: 2px solid #00875A;
            border-radius: 6px;
            padding: 2px 5px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            font-size: 10px;
            font-weight: 700;
            color: #1e293b;
            white-space: nowrap;
            transform: translate(-50%, -100%);
          ">
            <span style="width: 5px; height: 5px; border-radius: 50%; background: #00875A;"></span>
            <span>${stop.name}</span>
          </div>
        `,
        iconSize: [80, 20],
        iconAnchor: [40, 10],
      });

      L.marker(stop.coords, { icon: stopIcon }).addTo(stopsLayerRef.current!);
    });
  }, [route]);

  // 3. Draw Vehicle Markers: №1042 (trailing red badge) and №1043 (leading green badge)
  useEffect(() => {
    if (!vehiclesLayerRef.current) return;
    vehiclesLayerRef.current.clearLayers();

    // Trailing Bus №1042 (Bunching risk, red pill with pulsing ring)
    const trailingBusIcon = L.divIcon({
      className: "trailing-bus-marker",
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%); cursor: pointer;">
          <!-- Pulsing halo ring -->
          <div style="
            position: absolute;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.25);
            animation: pulse-ring 2s infinite;
          "></div>
          
          <!-- Badge Pill -->
          <div style="
            position: relative;
            z-index: 10;
            display: flex;
            align-items: center;
            gap: 4px;
            background: #dc2626;
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 9999px;
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
            border: 2px solid #ffffff;
            white-space: nowrap;
          ">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></span>
            <span>№1042 • Приближение Δ 1.4 мин</span>
          </div>
          
          <!-- Vehicle Direction Pin -->
          <div style="
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #dc2626;
            border: 2px solid #ffffff;
            margin-top: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          ">
            <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
          </div>
        </div>
      `,
      iconSize: [220, 48],
      iconAnchor: [110, 24],
    });

    const trailingMarker = L.marker([55.7765, 37.6920], { icon: trailingBusIcon });
    trailingMarker.on("click", () => onSelectVehicle("P1042"));
    vehiclesLayerRef.current.addLayer(trailingMarker);

    // Leading Bus №1043 (Green Leader Badge)
    const leadingBusIcon = L.divIcon({
      className: "leading-bus-marker",
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%); cursor: pointer;">
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            background: #00875A;
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 9999px;
            box-shadow: 0 4px 12px rgba(0, 135, 90, 0.35);
            border: 2px solid #ffffff;
            white-space: nowrap;
          ">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></span>
            <span>№1043 (Лидер)</span>
          </div>
          <div style="
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #00875A;
            border: 2px solid #ffffff;
            margin-top: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          ">
            <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
          </div>
        </div>
      `,
      iconSize: [140, 48],
      iconAnchor: [70, 24],
    });

    const leadingMarker = L.marker([55.7735, 37.6815], { icon: leadingBusIcon });
    leadingMarker.on("click", () => onSelectVehicle("P1043"));
    vehiclesLayerRef.current.addLayer(leadingMarker);
  }, [vehicles, onSelectVehicle]);

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
      <div className="absolute top-4 left-[380px] z-20 flex flex-col gap-1 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/90 shadow-lg pointer-events-auto">
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
          title="Приблизить"
        >
          <Plus size={15} />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
          title="Отдалить"
        >
          <Minus size={15} />
        </button>
        <div className="h-px bg-slate-200 my-0.5" />
        <button
          onClick={() => mapInstanceRef.current?.flyTo([55.7745, 37.6850], 13)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
          title="Центрировать на перегоне"
        >
          <Crosshair size={14} />
        </button>
        <button
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
          title="Слои карты"
        >
          <Layers size={14} />
        </button>
      </div>

      {/* 3. Floating Bottom Center Horizon Scrubber Capsule */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-md rounded-full border border-slate-200/90 shadow-xl px-5 py-2.5 flex items-center gap-3.5 min-w-[580px]">
          {/* Play/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors shadow-2xs shrink-0 cursor-pointer"
            title={isPlaying ? "Пауза" : "Воспроизведение"}
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
          </button>

          {/* Rewind */}
          <button
            onClick={() => onTimeStepChange("Сейчас")}
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 cursor-pointer"
            title="К текущему моменту"
          >
            <SkipBack size={14} />
          </button>

          {/* Time Steps and Track */}
          <div className="flex-1 flex flex-col gap-1 px-1">
            {/* Slider track with active thumb */}
            <div className="relative w-full h-1.5 bg-slate-200 rounded-full flex items-center">
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
                className="absolute w-3.5 h-3.5 rounded-full bg-white border-2 border-[#00875A] shadow-md transition-all cursor-pointer"
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
            <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 pt-0.5">
              <button
                onClick={() => onTimeStepChange("Сейчас")}
                className={`cursor-pointer transition-colors ${
                  timeStep === "Сейчас" ? "text-slate-900 font-bold" : "hover:text-slate-800"
                }`}
              >
                Сейчас [T=0]
              </button>

              <button
                onClick={() => onTimeStepChange("+15 мин")}
                className={`px-2 py-0.5 rounded-full cursor-pointer transition-all ${
                  timeStep === "+15 мин"
                    ? "bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-300"
                    : "hover:text-slate-800"
                }`}
              >
                T+15 min (Прогноз)
              </button>

              <button
                onClick={() => onTimeStepChange("+30 мин")}
                className={`cursor-pointer transition-colors ${
                  timeStep === "+30 мин" ? "text-slate-900 font-bold" : "hover:text-slate-800"
                }`}
              >
                T+30 min
              </button>

              <button
                onClick={() => onTimeStepChange("+45 мин")}
                className={`cursor-pointer transition-colors ${
                  timeStep === "+45 мин" ? "text-slate-900 font-bold" : "hover:text-slate-800"
                }`}
              >
                T+45 min
              </button>
            </div>
          </div>

          {/* Next Arrow */}
          <button
            onClick={() => onTimeStepChange("+30 мин")}
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 cursor-pointer"
            title="Следующий горизонт"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Bottom subtle watermark note */}
        <div className="text-[10px] text-slate-400 text-center font-medium mt-1">
          Картографическая основа: CartoDB Positron / ЕГКС Мосгортранс
        </div>
      </div>
    </div>
  );
};

export default MapView;
