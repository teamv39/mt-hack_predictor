import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  Video,
  Clock,
  AlertTriangle,
  Radio,
  Eye,
  ChevronUp,
  ChevronDown,
  Navigation2,
  ShieldCheck,
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
    intersection: string;
    status: string;
    resolution: string;
    congestionLevel: string;
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
  const bunchingLayerRef = useRef<L.LayerGroup | null>(null);

  const [cameraMinimized, setCameraMinimized] = useState<boolean>(false);
  const [liveSecond, setLiveSecond] = useState<number>(34);

  // Time simulation points
  const timeSteps = [
    { id: "Сейчас (14:30)", label: "Сейчас (14:30)" },
    { id: "+15 мин", label: "+15 мин" },
    { id: "+30 мин", label: "+30 мин (Выбран)" },
    { id: "+45 мин", label: "+45 мин" },
  ];

  // Tick seconds for live camera simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveSecond((prev) => (prev + 1) % 60);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [55.7745, 37.6854], // Baumanskaya area
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    // CartoDB Positron Light Tiles
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      }
    ).addTo(map);

    // Zoom control on the top right
    L.control.zoom({ position: "topright" }).addTo(map);

    routeLayerRef.current = L.layerGroup().addTo(map);
    stopsLayerRef.current = L.layerGroup().addTo(map);
    vehiclesLayerRef.current = L.layerGroup().addTo(map);
    bunchingLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render Route and Stops
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !route || !routeLayerRef.current || !stopsLayerRef.current) return;

    routeLayerRef.current.clearLayers();
    stopsLayerRef.current.clearLayers();

    // 1. Normal stretch (emerald/blue - штатное движение)
    if (route.normalPolyline && route.normalPolyline.length > 0) {
      // Glow background line
      L.polyline(route.normalPolyline, {
        color: "#10b981",
        weight: 8,
        opacity: 0.25,
        lineCap: "round",
      }).addTo(routeLayerRef.current);

      // Core route line
      L.polyline(route.normalPolyline, {
        color: "#059669",
        weight: 5,
        opacity: 0.95,
        lineCap: "round",
      }).addTo(routeLayerRef.current);
    }

    // 2. Risk stretch between Baumanskaya and Semenovskaya (orange-red - зона риска пачкования)
    const isHoldingApplied = alert?.recommendation?.applied;
    if (route.riskPolyline && route.riskPolyline.length > 0) {
      const riskColor = isHoldingApplied ? "#10b981" : "#ef4444";
      const riskWeight = isHoldingApplied ? 5 : 6;

      // Outer glow
      L.polyline(route.riskPolyline, {
        color: riskColor,
        weight: 10,
        opacity: isHoldingApplied ? 0.2 : 0.35,
        lineCap: "round",
      }).addTo(routeLayerRef.current);

      // Inner dashed line
      L.polyline(route.riskPolyline, {
        color: riskColor,
        weight: riskWeight,
        dashArray: isHoldingApplied ? "" : "8, 6",
        opacity: 0.95,
        lineCap: "round",
      }).addTo(routeLayerRef.current);

      // Risk zone banner marker in the midpoint
      const midPoint = route.riskPolyline[Math.floor(route.riskPolyline.length / 2)];
      const riskBadgeIcon = L.divIcon({
        className: "risk-zone-marker",
        html: `
          <div style="
            background: ${isHoldingApplied ? "#ecfdf5" : "#fef2f2"};
            border: 1px solid ${isHoldingApplied ? "#a7f3d0" : "#fecaca"};
            color: ${isHoldingApplied ? "#065f46" : "#991b1b"};
            box-shadow: 0 4px 14px rgba(0,0,0,0.12);
            border-radius: 9999px;
            padding: 4px 10px;
            font-size: 10px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 5px;
            white-space: nowrap;
            transform: translate(-50%, -100%);
          ">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${
              isHoldingApplied ? "#10b981" : "#ef4444"
            };"></span>
            ${
              isHoldingApplied
                ? "Интервал стабилизирован (АСУ Holding)"
                : "Зона риска пачкования (интервал < 2 мин)"
            }
          </div>
        `,
        iconSize: [220, 24],
        iconAnchor: [110, 20],
      });

      L.marker(midPoint, { icon: riskBadgeIcon }).addTo(routeLayerRef.current);
    }

    // 3. Render Stops
    if (route.stops) {
      route.stops.forEach((stop: StopPoint) => {
        const isHolding = stop.isHoldingPoint;
        const isRisk = stop.isRiskZone;

        const stopIcon = L.divIcon({
          className: "stop-icon-wrapper",
          html: `
            <div style="position:relative; display:flex; align-items:center; justify-content:center;">
              <div class="stop-marker-dot ${isHolding ? "holding" : isRisk ? "risk" : ""}"></div>
              ${
                isHolding
                  ? `<div style="
                      position: absolute;
                      top: -18px;
                      background: #10b981;
                      color: white;
                      font-size: 8px;
                      font-weight: 800;
                      padding: 1px 4px;
                      border-radius: 4px;
                      white-space: nowrap;
                      box-shadow: 0 2px 5px rgba(16,185,129,0.3);
                    ">HOLDING</div>`
                  : ""
              }
            </div>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const marker = L.marker([stop.lat, stop.lon], { icon: stopIcon });
        marker.bindTooltip(
          `<strong>${stop.name}</strong>${
            stop.subwayTransfer ? `<br/><span style="color:#2563eb">Пересадка: ${stop.subwayTransfer}</span>` : ""
          }`,
          {
            direction: "top",
            className: "glass-tooltip",
          }
        );
        stopsLayerRef.current?.addLayer(marker);
      });
    }
  }, [route, alert]);

  // Render Vehicles and Dynamic Bunching Link
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !vehiclesLayerRef.current || !bunchingLayerRef.current) return;

    vehiclesLayerRef.current.clearLayers();
    bunchingLayerRef.current.clearLayers();

    const isHoldingApplied = alert?.recommendation?.applied;

    vehicles.forEach((veh) => {
      const isSelected = veh.id === selectedVehicleId;
      const isBunchingRisk = veh.id === "P1042" && !isHoldingApplied;
      const isNormal = !isBunchingRisk && veh.status !== "DELAYED";

      const badgeColor = isBunchingRisk ? "danger" : isNormal ? "normal" : "warning";
      const delayText =
        veh.delaySeconds > 60
          ? `+${Math.round(veh.delaySeconds / 60)} мин`
          : `${veh.speedKmh} км/ч`;

      const vehicleIcon = L.divIcon({
        className: "bus-marker-wrapper",
        html: `
          <div class="bus-marker-container" style="transform: ${isSelected ? "scale(1.15)" : "scale(1)"};">
            <div class="bus-marker-pill ${badgeColor}">
              <span style="display:inline-block; transform: rotate(${veh.heading}deg);">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                </svg>
              </span>
              <span>${veh.id}</span>
            </div>
            <div class="bus-marker-sub">
              ${isBunchingRisk ? `<span style="color:#dc2626;">${delayText}</span>` : delayText}
            </div>
          </div>
        `,
        iconSize: [52, 42],
        iconAnchor: [26, 21],
      });

      const marker = L.marker([veh.latitude, veh.longitude], {
        icon: vehicleIcon,
      });

      marker.on("click", () => {
        onSelectVehicle(veh.id);
      });

      vehiclesLayerRef.current?.addLayer(marker);
    });

    // Draw dynamic headway line between P1042 and P1043
    const v1042 = vehicles.find((v) => v.id === "P1042");
    const v1043 = vehicles.find((v) => v.id === "P1043");

    if (v1042 && v1043) {
      const lineColor = isHoldingApplied ? "#10b981" : "#ef4444";
      const lineText = isHoldingApplied
        ? "Интервал: 7.5 мин (Стабильно)"
        : "Интервал: 1.5 мин (Схлопывание!)";

      // Polyline connecting the two buses
      L.polyline(
        [
          [v1042.latitude, v1042.longitude],
          [v1043.latitude, v1043.longitude],
        ],
        {
          color: lineColor,
          weight: 3,
          dashArray: "5, 6",
          opacity: 0.9,
        }
      ).addTo(bunchingLayerRef.current);

      // Midpoint headway badge
      const midLat = (v1042.latitude + v1043.latitude) / 2;
      const midLon = (v1042.longitude + v1043.longitude) / 2;

      const headwayIcon = L.divIcon({
        className: "headway-badge-icon",
        html: `
          <div style="
            background: #ffffff;
            border: 1px solid ${lineColor};
            color: ${lineColor};
            font-size: 9px;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 9999px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            white-space: nowrap;
            transform: translate(-50%, -50%);
          ">
            ${lineText}
          </div>
        `,
        iconSize: [120, 20],
        iconAnchor: [60, 10],
      });

      L.marker([midLat, midLon], { icon: headwayIcon }).addTo(bunchingLayerRef.current);
    }
  }, [vehicles, selectedVehicleId, alert, onSelectVehicle]);

  // Fly to target coordinate on user click
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && flyToTarget) {
      map.flyTo([flyToTarget.lat, flyToTarget.lon], flyToTarget.zoom || 15, {
        duration: 1.2,
        easeLinearity: 0.25,
      });
    }
  }, [flyToTarget]);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden">
      {/* 100% Leaflet Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Floating Widget 1: Bottom-Left Live Camera Preview Mini-Card */}
      <div className="absolute bottom-5 left-5 z-20 pointer-events-auto">
        <div className="w-72 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden transition-all duration-300">
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-[11px] font-bold tracking-wide">
                {camera.id}: {camera.location}
              </span>
            </div>
            <button
              onClick={() => setCameraMinimized(!cameraMinimized)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {cameraMinimized ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>

          {/* Camera View Body */}
          {!cameraMinimized && (
            <div className="p-3">
              {/* Simulated CCTV Frame */}
              <div className="relative w-full h-32 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between p-2 shadow-inner">
                {/* Simulated Road graphic */}
                <div className="absolute inset-0 opacity-40">
                  <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                    <line x1="0" y1="80" x2="200" y2="40" stroke="#475569" strokeWidth="24" />
                    <line
                      x1="0"
                      y1="80"
                      x2="200"
                      y2="40"
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray="8 6"
                    />
                    {/* Moving vehicle dots */}
                    <circle cx="65" cy="67" r="5" fill="#ef4444" />
                    <circle cx="110" cy="58" r="5" fill="#3b82f6" />
                    <circle cx="145" cy="51" r="5" fill="#10b981" />
                  </svg>
                </div>

                {/* Scanline overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent pointer-events-none" />

                {/* Top overlay tags */}
                <div className="relative z-10 flex items-center justify-between text-[10px] text-slate-300 font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-black/60 font-bold text-red-400">
                    REC [CAM-04]
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-black/60">
                    14:30:{liveSecond < 10 ? `0${liveSecond}` : liveSecond} MSK
                  </span>
                </div>

                {/* Bottom overlay tags */}
                <div className="relative z-10 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                  <span>{camera.resolution}</span>
                  <span className="text-amber-400 font-semibold">{camera.congestionLevel}</span>
                </div>
              </div>

              {/* Camera metadata */}
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                <span className="truncate max-w-[180px]">{camera.intersection}</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <Video size={10} /> RTSP OK
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Widget 2: Bottom-Center "Моделирование во времени" */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl px-3 py-2 flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 pr-2 border-r border-slate-200 shrink-0">
            <Clock size={14} className="text-blue-600" />
            <span className="hidden sm:inline">Моделирование во времени:</span>
          </div>

          <div className="flex items-center gap-1">
            {timeSteps.map((step) => {
              const isSelected =
                timeStep === step.id || (step.id === "+30 мин" && timeStep === "+30 мин");
              return (
                <button
                  key={step.id}
                  onClick={() => onTimeStepChange(step.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/20"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {step.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
