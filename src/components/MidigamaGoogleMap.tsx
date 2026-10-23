import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";

type MapPlace = {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  distanceMeters: number | null;
  category: "accommodation" | "demand";
};

type MidigamaGoogleMapProps = {
  site: { latitude: number; longitude: number };
  places: MapPlace[];
  radiusKm: number;
};

let mapsConfigured = false;

const formatDistance = (meters: number | null) => {
  if (meters === null) return "Distance unavailable";
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

export default function MidigamaGoogleMap({
  site,
  places,
  radiusKm,
}: MidigamaGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();

    if (!apiKey) {
      setError("VITE_GOOGLE_MAPS_API_KEY is not configured.");
      return;
    }

    if (!mapsConfigured) {
      setOptions({ key: apiKey, v: "weekly" });
      mapsConfigured = true;
    }

    const renderMap = async () => {
      try {
        const { Map, InfoWindow } = await importLibrary("maps");
        const { AdvancedMarkerElement, PinElement } =
          await importLibrary("marker");
        if (cancelled || !containerRef.current) return;

        const sitePosition = { lat: site.latitude, lng: site.longitude };
        const map = new Map(containerRef.current, {
          center: sitePosition,
          zoom: radiusKm === 1 ? 15 : radiusKm === 3 ? 14 : 13,
          mapId: "DEMO_MAP_ID",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "cooperative",
        });
        const infoWindow = new InfoWindow();

        const sitePin = new PinElement({
          background: "#ff6b4a",
          borderColor: "#172d24",
          glyphColor: "#172d24",
          scale: 1.35,
        });
        const siteMarker = new AdvancedMarkerElement({
          map,
          position: sitePosition,
          title: "Plot 8",
          content: sitePin.element,
          zIndex: 10,
        });
        siteMarker.addListener("click", () => {
          infoWindow.setContent("<strong>Plot 8</strong><br>Proposed villa site");
          infoWindow.open({ map, anchor: siteMarker });
        });

        for (const place of places) {
          const accommodation = place.category === "accommodation";
          const pin = new PinElement({
            background: accommodation ? "#ff6b4a" : "#56b7d3",
            borderColor: accommodation ? "#8e321e" : "#13576c",
            glyphColor: "#ffffff",
            scale: 0.8,
          });
          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: place.latitude, lng: place.longitude },
            title: place.name,
            content: pin.element,
          });
          marker.addListener("click", () => {
            infoWindow.setContent(
              `<strong>${place.name}</strong><br>${place.type} · ${formatDistance(place.distanceMeters)}`,
            );
            infoWindow.open({ map, anchor: marker });
          });
        }

        setError("");
      } catch (mapError) {
        if (!cancelled) {
          setError(String((mapError as Error)?.message || mapError));
        }
      }
    };

    void renderMap();
    return () => {
      cancelled = true;
    };
  }, [places, radiusKm, site]);

  if (error) {
    return (
      <div className="midigama-google-map-error" role="alert">
        <strong>Google Map unavailable</strong>
        <span>{error}</span>
        <a
          href={`https://www.google.com/maps?q=${site.latitude},${site.longitude}`}
          target="_blank"
          rel="noreferrer"
        >
          Open Plot 8 in Google Maps
        </a>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="midigama-google-map"
      aria-label="Google Map of Plot 8, accommodation, and demand drivers"
    />
  );
}