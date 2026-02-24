export type PowerBackup = "generator" | "inverter" | "none" | "unknown";

// Venue DTO shape returned by the Netlify functions.
// Note: many fields are optional in the UI because older records or partial updates
// may omit them, but the DB defaults ensure these are non-null when present.
export interface Venue {
  id?: string;
  destinationSlug?: string;
  name?: string;
  slug?: string;
  status?: string;
  live?: boolean;

  // Curation & filtering
  editorialTags?: string[];
  isPassVenue?: boolean;
  staffPick?: boolean;
  priorityScore?: number;
  laptopFriendly?: boolean;
  powerBackup?: PowerBackup;

  // Taxonomy/content
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
  offers?: unknown[] | string;
  howToClaim?: string;
  restrictions?: string;

  // Location/media
  area?: string;
  lat?: number;
  lng?: number;
  logo?: string;
  image?: string;
  ogImage?: string;
  mapUrl?: string;
  instagramUrl?: string;
  whatsapp?: string;

  // Timestamps
  updatedAt?: string;
  updated_at?: string;
  createdAt?: string;
  created_at?: string;
}
