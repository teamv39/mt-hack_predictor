import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  Clock,
  AlertTriangle,
  Plus,
  Minus,
  Layers,
  Video,
  Crosshair,
  Maximize2,
} from "lucide-react";
import { Vehicle, AlertItem, RouteData, StopPoint } from "../mock/telemetry";

interface MapViewProps {
  route: RouteData;
  vehicles: Vehicle[];
  alert: AlertItem | null;
  selectedVehicleId: string;
  onSelectVehicle: (id: string) => void;
  flyToTarget: { lat: number; lon: number; zoom?: number } | null;
  timeStep: string;
  onTimeStepChange: (step: string) => void;
  camera: {
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
  camera,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesLayerRef = useRef<L.LayerGroup | null>(null);

  const [liveSec, setLiveSec] = useState<number>(14);

  // Tick seconds for CCTV simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveSec((s) => (s + 1) % 60);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Leaflet Map with CartoDB Positron clean light layer
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [55.7725, 37.6830], // Moscow: Baumanskaya / Semyonovskaya cluster
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    routeLayerRef.current = L.layerGroup().addTo(map);
    stopsLayerRef.current = L.layerGroup().addTo(map);
    vehiclesLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Draw Polylines, Risk Shading Polygon, and Stop Labels matching screenshot
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !route || !routeLayerRef.current || !stopsLayerRef.current) return;

    routeLayerRef.current.clearLayers();
    stopsLayerRef.current.clearLayers();

    // 1. Shaded Corridor Polygon (soft peach/coral tint matching screenshot)
    if (route.riskPolygon && route.riskPolygon.length > 0) {
      L.polygon(route.riskPolygon, {
        color: "#fb923c",
        fillColor: "#fed7aa",
        fillOpacity: 0.45,
        weight: 1,
        dashArray: "3, 3",
      }).addTo(routeLayerRef.current);
    }

    // 2. Green route line (passing through Semyonovskaya)
    if (route.greenPolyline && route.greenPolyline.length > 0) {
      L.polyline(route.greenPolyline, {
        color: "#10b981",
        weight: 4,
        opacity: 0.9,
        lineCap: "round",
      }).addTo(routeLayerRef.current);
    }

    // 3. Orange route line (passing through Baumanskaya)
    if (route.orangePolyline && route.orangePolyline.length > 0) {
      L.polyline(route.orangePolyline, {
        color: "#f97316",
        weight: 4,
        opacity: 0.85,
        lineCap: "round",
      }).addTo(routeLayerRef.current);
    }

    // 4. Red corridor polyline with pulsing risk zone
    const isHoldingApplied = alert?.recommendation?.applied;
    if (route.redCorridorPolyline && route.redCorridorPolyline.length > 0) {
      const redColor = isHoldingApplied ? "#10b981" : "#ef4444";

      // Outer glow
      L.polyline(route.redCorridorPolyline, {
        color: redColor,
        weight: 12,
        opacity: 0.25,
        lineCap: "round",
      }).addTo(routeLayerRef.current);

      // Core red path
      L.polyline(route.redCorridorPolyline, {
        color: redColor,
        weight: 5,
        opacity: 1,
        lineCap: "round",
      }).addTo(routeLayerRef.current);

      // Floating Risk Badge over the corridor: ⚠️ ЗОНА РИСКА ПАЧКОВАНИЯ (интервал < 2 мин)
      const midPoint = route.redCorridorPolyline[2];
      const riskBadgeIcon = L.divIcon({
        className: "risk-zone-badge",
        html: `
          <div style="
            background: #ffe4e6;
            border: 1px solid #fecdd3;
            color: #be123c;
            box-shadow: 0 4px 14px rgba(190, 18, 60, 0.15);
            border-radius: 9999px;
            padding: 4px 12px;
            font-size: 11px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
            transform: translate(-50%, -100%);
          ">
            <span>⚠️</span>
            <span>${
              isHoldingApplied
                ? "ИНТЕРВАЛ СТАБИЛИЗИРОВАН (АСУ-РДС)"
                : "ЗОНА РИСКА ПАЧКОВАНИЯ (интервал < 2 мин)"
            }</span>
          </div>
        `,
        iconSize: [260, 26],
        iconAnchor: [130, 20],
      });

      L.marker(midPoint, { icon: riskBadgeIcon }).addTo(routeLayerRef.current);
    }

    // 5. Render Stops: м. Бауманская (orange) and м. Семёновская (teal/green)
    route.stops.forEach((stop: StopPoint) => {
      const stopIcon = L.divIcon({
        className: "custom-stop-marker",
        html: `
          <div style="display:flex; align-items:center; gap:6px; cursor:pointer;">
            <div style="
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: #ffffff;
              border: 3.5px solid ${stop.color};
              box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            "></div>
            <span style="
              font-size: 11px;
              font-weight: 800;
              color: #0f172a;
              background: rgba(255, 255, 255, 0.95);
              padding: 2px 6px;
              border-radius: 6px;
              box-shadow: 0 1px 4px rgba(0,0,0,0.1);
              white-space: nowrap;
            ">
              ${stop.name}
            </span>
          </div>
        `,
        iconSize: [120, 20],
        iconAnchor: [7, 10],
      });

      L.marker([stop.lat, stop.lon], { icon: stopIcon }).addTo(stopsLayerRef.current!);
    });

    // 6. District label overlay: ПРЕОБРАЖЕНСКОЕ
    const districtIcon = L.divIcon({
      className: "district-label-marker",
      html: `
        <div style="
          font-size: 14px;
          font-weight: 800;
          color: #94a3b8;
          letter-spacing: 3px;
          opacity: 0.6;
          user-select: none;
          pointer-events: none;
          text-transform: uppercase;
        ">
          ПРЕОБРАЖЕНСКОЕ
        </div>
      `,
      iconSize: [200, 24],
      iconAnchor: [100, 12],
    });
    L.marker([55.7890, 37.7120], { icon: districtIcon }).addTo(stopsLayerRef.current!);
  }, [route, alert]);

  // Render Vehicle Markers matching screenshot
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !vehiclesLayerRef.current) return;

    vehiclesLayerRef.current.clearLayers();

    vehicles.forEach((veh) => {
      const isRed = veh.id === "P1042";

      const vehicleIcon = L.divIcon({
        className: "vehicle-badge-marker",
        html: `
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: ${isRed ? "#ef4444" : "#10b981"};
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 6px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            white-space: nowrap;
            cursor: pointer;
            border: 1.5px solid #ffffff;
            transform: translate(-50%, -50%);
          ">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="transform: rotate(${veh.heading}deg);">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
            <span>${veh.badgeLabel}</span>
          </div>
        `,
        iconSize: [110, 24],
        iconAnchor: [55, 12],
      });

      const marker = L.marker([veh.latitude, veh.longitude], { icon: vehicleIcon });
      marker.on("click", () => onSelectVehicle(veh.id));
      vehiclesLayerRef.current?.addLayer(marker);
    });
  }, [vehicles, onSelectVehicle]);

  // Fly to target coordinate on user click
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
      {/* 100% Leaflet Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Floating Toolbar (Positioned clear of left panel) */}
      <div className="absolute top-4 left-[390px] xl:left-[410px] z-20 flex flex-col gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/90 shadow-lg pointer-events-auto">
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
          title="Приблизить"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
          title="Отдалить"
        >
          <Minus size={16} />
        </button>
        <div className="h-[1px] bg-slate-200 my-0.5" />
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors">
          <Layers size={15} />
        </button>
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors">
          <Video size={15} />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.flyTo([55.7725, 37.6830], 13)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
          title="Сброс к Бауманской"
        >
          <Crosshair size={15} />
        </button>
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Floating Bottom-Left CCTV Widget (Matches AlertRadar width: 360px) */}
      <div className="absolute bottom-20 left-4 z-20 pointer-events-auto">
        <div className="w-[360px] bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg p-2.5">
          {/* Header */}
          <div className="px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-800">
              {camera.id}: {camera.location}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-black text-[9px] uppercase tracking-wider animate-pulse">
              LIVE
            </span>
          </div>

          {/* Perspective 3D traffic illustration matching screenshot */}
          <div>
            <div className="relative w-full h-20 bg-gradient-to-b from-slate-100 to-slate-200 rounded-lg overflow-hidden border border-slate-300 flex items-center justify-center">
              {/* Isometric roads and vehicles graphic */}
              <svg className="w-full h-full" viewBox="0 0 340 90">
                {/* Road perspective planes */}
                <polygon points="10,85 330,85 240,15 100,15" fill="#cbd5e1" opacity="0.7" />
                <line x1="170" y1="15" x2="170" y2="85" stroke="#ffffff" strokeWidth="2" strokeDasharray="6 4" />
                <line x1="135" y1="15" x2="90" y2="85" stroke="#e2e8f0" strokeWidth="1.5" />
                <line x1="205" y1="15" x2="250" y2="85" stroke="#e2e8f0" strokeWidth="1.5" />

                {/* Overpass / bridge */}
                <rect x="50" y="32" width="240" height="12" rx="4" fill="#94a3b8" opacity="0.8" />
                <rect x="55" y="34" width="230" height="8" rx="2" fill="#64748b" />

                {/* Cars */}
                <rect x="150" y="60" width="13" height="18" rx="2" fill="#ef4444" />
                <rect x="180" y="46" width="11" height="14" rx="2" fill="#3b82f6" />
                <rect x="110" y="64" width="11" height="15" rx="2" fill="#10b981" />
                <rect x="210" y="68" width="12" height="16" rx="2" fill="#f59e0b" />
              </svg>

              <div className="absolute top-1.5 left-2 text-[9px] font-mono text-slate-500 font-bold">
                14:30:{liveSec < 10 ? `0${liveSec}` : liveSec}
              </div>
            </div>

            <div className="mt-1 px-0.5 text-[10px] text-slate-500 font-medium truncate">
              {camera.footerText}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom-Center Timeline Slider Panel matching screenshot */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl px-5 py-2.5 flex flex-col gap-2 min-w-[500px]">
          {/* Top row: Label + Status Pills */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase">
              <Clock size={14} className="text-blue-600" />
              <span>Моделирование во времени</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-bold border border-sky-200/60">
                Обычный срез / соответствие
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                Расчетный горизонт
              </span>
              <span className="text-xs font-black text-slate-900">
                15:02 (T+38)
              </span>
            </div>
          </div>

          {/* Bottom row: Timeline Track with 4 buttons */}
          <div className="relative flex items-center justify-between pt-1">
            {/* Timeline line behind */}
            <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-200 -translate-y-1/2 rounded-full" />

            <button
              onClick={() => onTimeStepChange("Сейчас")}
              className="relative z-10 px-3 py-1 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 transition-all"
            >
              Сейчас: 14:30
            </button>

            <button
              onClick={() => onTimeStepChange("+15 мин")}
              className="relative z-10 px-3 py-1 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 transition-all"
            >
              +15 мин
            </button>

            {/* Active Pill matching screenshot: +30 мин (Выбран) */}
            <button
              onClick={() => onTimeStepChange("+30 мин")}
              className="relative z-10 px-3.5 py-1 rounded-xl text-xs font-black text-white bg-blue-600 shadow-md shadow-blue-500/25 ring-2 ring-blue-500/20 transition-all flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              <span>+30 мин (Выбран)</span>
            </button>

            <button
              onClick={() => onTimeStepChange("+45 мин")}
              className="relative z-10 px-3 py-1 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 transition-all"
            >
              +45 мин
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
