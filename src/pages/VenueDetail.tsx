import { VenueImages } from "../components/VenueImages";
import { VenueBasicInfo } from "../components/VenueBasicInfo";
import { VenueCategoriesTags } from "../components/VenueCategoriesTags";
import { VenueRatingsOffers } from "../components/VenueRatingsOffers";
import { VenueDescription } from "../components/VenueDescription";
import { VenueLocationSocial } from "../components/VenueLocationSocial";
import { useEffect, useState } from "react";

interface Venue {
  id?: string;
  destinationSlug?: string;
  name?: string;
  slug?: string;
  status?: string;
  live?: boolean;
  categories?: string[];
  emoji?: string[];
  stars?: number;
  reviews?: number;
  discount?: number;
  excerpt?: string;
  description?: string;
  bestFor?: string[];
  tags?: string[];
  cardPerk?: string;
  offers?: string[] | string;
  howToClaim?: string;
  restrictions?: string;
  area?: string;
  lat?: number;
  lng?: number;
  logo?: string;
  image?: string;
  ogImage?: string;
  mapUrl?: string;
  instagramUrl?: string;
  whatsapp?: string;
  updatedAt?: string;
  updated_at?: string;
  createdAt?: string;
  created_at?: string;
}

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
        border: "1px solid #eee",
        borderRadius: 8,
        padding: 24,
        background: "#fafafa",
        width: "50vw",
        minWidth: 400,
        maxWidth: "50vw",
        maxHeight: "80vh",
        overflowY: "auto",
        marginTop: 32,
      }}
    >
      <h2 style={{ marginTop: 0 }}>{localVenue?.name}</h2>
      <VenueImages venue={localVenue} />
      <VenueBasicInfo venue={localVenue} onVenueUpdated={handleVenueUpdated} />
      <VenueCategoriesTags venue={localVenue} />
      <VenueRatingsOffers venue={localVenue} />
      <VenueDescription venue={localVenue} />
      <VenueLocationSocial venue={localVenue} />
    </div>
  );
}
