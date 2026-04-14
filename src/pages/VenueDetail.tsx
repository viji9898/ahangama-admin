import { VenueImages } from "../components/VenueImages";
import { VenueBasicInfo } from "../components/VenueBasicInfo";
import { VenueCategoriesTags } from "../components/VenueCategoriesTags";
import { VenueRatingsOffers } from "../components/VenueRatingsOffers";
import { VenueDescription } from "../components/VenueDescription";
import { VenueLocationSocial } from "../components/VenueLocationSocial";
import { VenueCuration } from "../components/VenueCuration";
import { useEffect, useState } from "react";

import type { Venue } from "../types/venue";

type Props = {
  venue?: Venue;
  onVenueUpdated?: (venue: Partial<Venue>) => void;
};

export default function VenueDetail({ venue, onVenueUpdated }: Props) {
  const [localVenue, setLocalVenue] = useState<Venue | undefined>(venue);

  useEffect(() => {
    setLocalVenue(venue);
  }, [venue]);

  const handleVenueUpdated = (updated: Partial<Venue> | undefined) => {
    if (!updated) return;
    onVenueUpdated?.(updated);
    setLocalVenue((prev) => {
      const updatedId = updated?.id;
      if (prev?.id && updatedId && prev.id === updatedId) {
        return { ...prev, ...updated };
      }
      return { ...(prev || {}), ...updated };
    });
  };

  if (!localVenue) {
    return (
      <div style={{ color: "#888", padding: 24 }}>
        Select a venue to view details.
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid rgba(15, 23, 42, 0.06)",
        borderRadius: 20,
        padding: 24,
        background: "rgba(250, 250, 249, 0.92)",
        width: "100%",
        minWidth: 0,
        maxWidth: "none",
        maxHeight: "calc(100vh - 240px)",
        overflowY: "auto",
        boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
      }}
    >
      <h2 style={{ marginTop: 0 }}>{localVenue?.name}</h2>
      <VenueImages venue={localVenue} onVenueUpdated={handleVenueUpdated} />
      <VenueBasicInfo venue={localVenue} onVenueUpdated={handleVenueUpdated} />
      <VenueCuration venue={localVenue} onVenueUpdated={handleVenueUpdated} />
      <VenueCategoriesTags venue={localVenue} />
      <VenueRatingsOffers
        venue={localVenue}
        onVenueUpdated={handleVenueUpdated}
      />
      <VenueDescription
        venue={localVenue}
        onVenueUpdated={handleVenueUpdated}
      />
      <VenueLocationSocial
        venue={localVenue}
        onVenueUpdated={handleVenueUpdated}
      />
    </div>
  );
}
