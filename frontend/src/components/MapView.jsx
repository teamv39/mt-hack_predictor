import React, { useEffect, useRef } from "react";
import L from "leaflet";

export function MapView({
  route,
  vehicles,
  alert,
  selectedVehicleId,
  onSelectVehicle,
  flyToTarget,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylineLayerRef = useRef(null);
  const stopsLayerRef = useRef(null);
  const vehiclesLayerRef = useRef(null);
  const bunchingLineRef = useRef(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [55.7724, 37.6791], // Baumanskaya, Moscow
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    // Dark Matter tiles from CartoDB (free, high performance, gorgeous dark mode)
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        subdomains: "abcd",
      }
    ).addTo(map);

    // Zoom control at bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapInstanceRef.current = map;
    stopsLayerRef.current = L.layerGroup().addTo(map);
    vehiclesLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render Route Polyline and Stops
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !route) return;

    // Remove old polyline if any
    if (polylineLayerRef.current) {
      map.removeLayer(polylineLayerRef.current);
    }
    if (stopsLayerRef.current) {
      stopsLayerRef.current.clearLayers();
    }

    // Draw route polyline
    if (route.polyline && route.polyline.length > 0) {
      const latlngs = route.polyline.map((p) => [p.lat, p.lon]);
      const poly = L.polyline(latlngs, {
        color: "#3b82f6",
        weight: 5,
        opacity: 0.8,
        smoothFactor: 1,
      }).addTo(map);
      polylineLayerRef.current = poly;
    }

    // Draw stops
    if (route.stops) {
      route.stops.forEach((stop) => {
        const stopIcon = L.divIcon({
          className: "stop-marker-icon",
          html: `<div class="stop-marker-dot" title="${stop.name}"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });

        const marker = L.marker([stop.lat, stop.lon], { icon: stopIcon });
        marker.bindTooltip(stop.name, {
          permanent: false,
          direction: "top",
          className: "glass-tooltip",
        });
        stopsLayerRef.current.addLayer(marker);
      });
    }
  }, [route]);

  // Render Vehicles and Pulsing Bunching Link
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !vehiclesLayerRef.current) return;

    vehiclesLayerRef.current.clearLayers();

    if (bunchingLineRef.current) {
      map.removeLayer(bunchingLineRef.current);
      bunchingLineRef.current = null;
    }

    const isHoldingApplied = alert?.recommendation?.applied;

    // Draw vehicles
    vehicles.forEach((v) => {
      const isSelected = v.id === selectedVehicleId;
      const isBunching = v.status === "BUNCHING_RISK" && !isHoldingApplied;
      const isDelayed = v.delay_seconds > 180;

      let statusClass = "on-time";
      if (isBunching) statusClass = "bunching";
      else if (isDelayed) statusClass = "delayed";

      const delayLabel =
        v.delay_seconds > 60
          ? `+${Math.round(v.delay_seconds / 60)}m`
          : `${Math.round(v.speed_kmh)}km/h`;

      const vehicleIcon = L.divIcon({
        className: "bus-marker-icon",
        html: `
          <div style="position: relative; cursor: pointer; text-align: center;">
            <div class="bus-marker-box ${statusClass}" style="transform: ${
          isSelected ? "scale(1.15)" : "scale(1)"
        }; border: ${isSelected ? "2px solid #38bdf8" : "2px solid white"}">
              ${v.id}
            </div>
            <div style="
              position: absolute;
              bottom: -16px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(15, 23, 42, 0.9);
              border: 1px solid rgba(255, 255, 255, 0.2);
              border-radius: 4px;
              padding: 1px 4px;
              font-size: 9px;
              font-weight: 700;
              color: ${isBunching ? "#fca5a5" : "#cbd5e1"};
              white-space: nowrap;
            ">
              ${delayLabel}
            </div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([v.latitude, v.longitude], {
        icon: vehicleIcon,
      });

      marker.on("click", () => {
        onSelectVehicle && onSelectVehicle(v.id);
      });

      vehiclesLayerRef.current.addLayer(marker);
    });

    // Draw pulsing red line between vehicles if bunching risk is active
    if (vehicles.length >= 2 && !isHoldingApplied) {
      const v1 = vehicles[0];
      const v2 = vehicles[1];

      if (v1.status === "BUNCHING_RISK" || v2.status === "BUNCHING_RISK") {
        const line = L.polyline(
          [
            [v1.latitude, v1.longitude],
            [v2.latitude, v2.longitude],
          ],
          {
            color: "#ef4444",
            weight: 3,
            dashArray: "6, 8",
            opacity: 0.9,
          }
        ).addTo(map);

        bunchingLineRef.current = line;
      }
    }
  }, [vehicles, selectedVehicleId, alert]);

  // FlyTo animation
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && flyToTarget) {
      map.flyTo([flyToTarget.lat, flyToTarget.lon], 15, {
        duration: 1.5,
      });
    }
  }, [flyToTarget]);

  return <div ref={mapContainerRef} className="map-container" />;
}
