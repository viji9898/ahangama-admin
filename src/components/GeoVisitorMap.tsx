import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

export type GeographyLocation = {
  key: string;
  city: string;
  region: string;
  country: string;
  activeUsers: number;
  sessions: number;
  percentage: number;
  lat: number;
  lng: number;
};

type MarkerGroup = {
  key: string;
  lat: number;
  lng: number;
  activeUsers: number;
  sessions: number;
  percentage: number;
  locations: GeographyLocation[];
};

const integer = (value: number) =>
  new Intl.NumberFormat("en-US").format(Number(value || 0));
const percent = (value: number) => `${(Number(value || 0) * 100).toFixed(1)}%`;

function FitToLocations({ locations }: { locations: GeographyLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (!locations.length) return;
    if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lng], 5);
      return;
    }
    map.fitBounds(
      locations.map((location) => [location.lat, location.lng]),
      { padding: [36, 36], maxZoom: 5 },
    );
  }, [locations, map]);

  return null;
}

function MarkerDetails({ group }: { group: MarkerGroup }) {
  if (group.locations.length > 1) {
    return (
      <div className="geo-map__tooltip">
        <strong>{integer(group.locations.length)} locations</strong>
        <span>Active users: {integer(group.activeUsers)}</span>
        <span>Sessions: {integer(group.sessions)}</span>
        <span>Share of users: {percent(group.percentage)}</span>
        <small>Zoom in to explore individual cities.</small>
      </div>
    );
  }

  const location = group.locations[0];
  return (
    <div className="geo-map__tooltip">
      <strong>{location.city}</strong>
      <span>{location.region}</span>
      <span>{location.country}</span>
      <span>Active users: {integer(location.activeUsers)}</span>
      <span>Sessions: {integer(location.sessions)}</span>
      <span>Share of users: {percent(location.percentage)}</span>
    </div>
  );
}

function ClusteredMarkers({
  locations,
  totalActiveUsers,
}: {
  locations: GeographyLocation[];
  totalActiveUsers: number;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const groups = useMemo(() => {
    const gridSize = zoom <= 2 ? 72 : zoom <= 4 ? 56 : 42;
    const buckets = new Map<string, GeographyLocation[]>();
    for (const location of locations) {
      const point = map.project([location.lat, location.lng], zoom);
      const key = `${Math.floor(point.x / gridSize)}:${Math.floor(point.y / gridSize)}`;
      buckets.set(key, [...(buckets.get(key) || []), location]);
    }
    return [...buckets.entries()].map(([key, members]) => {
      const activeUsers = members.reduce(
        (sum, location) => sum + location.activeUsers,
        0,
      );
      const weight = Math.max(activeUsers, 1);
      return {
        key,
        lat:
          members.reduce(
            (sum, location) => sum + location.lat * location.activeUsers,
            0,
          ) / weight,
        lng:
          members.reduce(
            (sum, location) => sum + location.lng * location.activeUsers,
            0,
          ) / weight,
        activeUsers,
        sessions: members.reduce(
          (sum, location) => sum + location.sessions,
          0,
        ),
        percentage: totalActiveUsers > 0 ? activeUsers / totalActiveUsers : 0,
        locations: members,
      };
    });
  }, [locations, map, totalActiveUsers, zoom]);
  const maximum = Math.max(1, ...groups.map((group) => group.activeUsers));

  return groups.map((group) => {
    const radius = 7 + Math.sqrt(group.activeUsers / maximum) * 21;
    const clustered = group.locations.length > 1;
    return (
      <CircleMarker
        key={`${zoom}:${group.key}`}
        center={[group.lat, group.lng]}
        radius={radius}
        pathOptions={{
          color: "#1769e0",
          fillColor: "#2f7de1",
          fillOpacity: 0.5,
          opacity: 0.85,
          weight: 1.5,
        }}
        eventHandlers={
          clustered
            ? {
                click: () =>
                  map.flyTo(
                    [group.lat, group.lng],
                    Math.min(map.getZoom() + 2, 8),
                  ),
              }
            : undefined
        }
      >
        <Tooltip direction="top" sticky>
          <MarkerDetails group={group} />
        </Tooltip>
        {!clustered ? (
          <Popup>
            <MarkerDetails group={group} />
          </Popup>
        ) : null}
      </CircleMarker>
    );
  });
}

export default function GeoVisitorMap({
  locations,
  totalActiveUsers,
}: {
  locations: GeographyLocation[];
  totalActiveUsers: number;
}) {
  return (
    <div className="geo-map" aria-label="Visitor locations world map">
      <MapContainer
        center={[18, 8]}
        zoom={2}
        minZoom={2}
        maxZoom={12}
        scrollWheelZoom
        worldCopyJump
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FitToLocations locations={locations} />
        <ClusteredMarkers
          locations={locations}
          totalActiveUsers={totalActiveUsers}
        />
      </MapContainer>
    </div>
  );
}