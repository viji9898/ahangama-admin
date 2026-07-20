export type EventCategory =
  | "wellness"
  | "music"
  | "surf_ocean"
  | "food_drink"
  | "community"
  | "workshops"
  | "fitness"
  | "nightlife"
  | "arts_culture"
  | "markets";

export type EventRecurringType = "daily" | "weekly" | "monthly";
export type EventPriceType = "free" | "paid";
export type EventStatus = "draft" | "published";
export type EventEditorPriority = "low" | "medium" | "high";
export type EventAudience = "tourist" | "resident" | "both";
export type EventSeason = "high" | "shoulder" | "low";

export interface EventRecord {
  id: string;
  title: string;
  description?: string | null;
  category: EventCategory;
  subcategory?: string | null;
  venueId?: string | null;
  venueName: string;
  venueInstagram?: string | null;
  venueGoogleUrl?: string | null;
  venueLat?: number | null;
  venueLng?: number | null;
  directionsUrl?: string | null;
  instagramUrl?: string | null;
  startDate: string;
  endDate?: string | null;
  startTime: string;
  endTime?: string | null;
  dayKey?: string | null;
  weekday?: string | null;
  dayNumber?: string | null;
  month?: string | null;
  displayTime?: string | null;
  recurring: boolean;
  recurringType?: EventRecurringType | null;
  dayOfWeek?: string | null;
  priceType: EventPriceType;
  price?: string | null;
  bookingUrl?: string | null;
  whatsappNumber?: string | null;
  imageUrl?: string | null;
  imageUrls: string[];
  mobileImageUrl?: string | null;
  offerImageUrl?: string | null;
  offerText?: string | null;
  details: string[];
  venueLinks: string[];
  passBenefit?: {
    label?: string | null;
    discount?: string | null;
    perk?: string | null;
  } | null;
  eventOrder: number;
  sourceKey?: string | null;
  rawEvent?: Record<string, unknown> | null;
  tags: string[];
  featured: boolean;
  editorialPick: boolean;
  status: EventStatus;
  source?: string | null;
  lastVerifiedAt?: string | null;
  intelligenceScore: number;
  editorPriority: EventEditorPriority;
  editorNotes?: string | null;
  audience: EventAudience;
  season: EventSeason;
  featuredThisWeek: boolean;
  notes?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
