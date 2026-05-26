export type PartnerContactRole = "owner" | "manager" | "other";

export type TouchpointType =
  | "qr_stand"
  | "postcard_stand"
  | "tea_tin"
  | "tote_bag"
  | "other";

export type InteractionType =
  | "call"
  | "whatsapp"
  | "email"
  | "visit"
  | "feedback";

export type InteractionOutcome =
  | "pending"
  | "successful"
  | "no_response"
  | "not_interested";

export interface PartnerContact {
  id: string;
  venueId: string;
  venueName?: string | null;
  referenceKey: string;
  contactName: string;
  role: PartnerContactRole;
  email?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  notes?: string | null;
  isPrimary: boolean;
  active: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerTouchpointInventory {
  venueId: string;
  venueName?: string | null;
  touchpointType: TouchpointType;
  quantity: number;
  notes?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerInteraction {
  id: string;
  venueId: string;
  venueName?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  interactionType: InteractionType;
  outcomeStatus: InteractionOutcome;
  summary: string;
  feedback?: string | null;
  nextAction?: string | null;
  nextFollowUpAt?: string | null;
  interactionAt: string;
  createdBy?: string | null;
  createdAt: string;
}
