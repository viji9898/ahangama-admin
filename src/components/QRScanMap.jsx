import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";

const DEFAULT_CENTER = [5.9735, 80.3615];
const DEFAULT_ZOOM = 13;

function formatLabel(value) {
  const normalized = String(value || "unknown").trim();
  if (!normalized) return "Unknown";

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getCircleRadius(value, maxValue) {
  const safeValue = Math.max(Number(value || 0), 0);
  const safeMax = Math.max(Number(maxValue || 0), 0);

  if (safeValue <= 0 || safeMax <= 0) {
    return 8;
  }

  return 8 + Math.sqrt(safeValue / safeMax) * 22;
}

function getCircleColor(value) {
  if (value >= 0.1) return "#15803d";
  if (value >= 0.04) return "#ca8a04";
  if (value >= 0.02) return "#ea580c";
  return "#dc2626";
}

function FitToRows({ rows }) {
  const map = useMap();

  useEffect(() => {
    if (!rows.length) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    if (rows.length === 1) {
      map.setView([rows[0].lat, rows[0].lng], 15);
      return;
    }

    map.fitBounds(
      rows.map((row) => [row.lat, row.lng]),
      { padding: [32, 32] },
    );
  }, [map, rows]);

  return null;
}

export default function QRScanMap({
  rows,
  sizeMetric = "sessions",
  colorMetric = "purchaseRate",
}) {
  const maxValue = useMemo(() => {
    return rows.reduce(
      (currentMax, row) => Math.max(currentMax, Number(row[sizeMetric] || 0)),
      0,
    );
  }, [rows, sizeMetric]);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      style={{ height: 440, width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <FitToRows rows={rows} />
      {rows.map((row) => {
        const metricValue = Number(row[sizeMetric] || 0);
        const circleColor = getCircleColor(Number(row[colorMetric] || 0));

        return (
          <CircleMarker
            key={row.slug}
            center={[row.lat, row.lng]}
            radius={getCircleRadius(metricValue, maxValue)}
            pathOptions={{
              color: circleColor,
              fillColor: circleColor,
              fillOpacity: 0.46,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              <div className="qr-scan-map-tooltip">
                <strong>{row.label}</strong>
                <div>{row.area || "Ahangama"}</div>
                <div>Sessions: {row.sessions}</div>
                <div>CTA Clicks: {row.ctaClick}</div>
                <div>Purchases: {row.purchases}</div>
                <div>Revenue: {formatCurrency(row.revenue)}</div>
                <div>Conversion Rate: {formatPercent(row.conversionRate)}</div>
                <div>Purchase Rate: {formatPercent(row.purchaseRate)}</div>
                <div>
                  Top Surfaces: {row.topSurfaces.map((surface) => `${formatLabel(surface.surface)} (${surface.sessions})`).join(", ") || "-"}
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}