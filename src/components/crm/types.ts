import type { PartnerContactRole } from "../../types/crm";

export type DraftContact = {
  contactName: string;
  role: PartnerContactRole;
  email?: string;
  whatsapp?: string;
  phone?: string;
  notes?: string;
  isPrimary: boolean;
  active: boolean;
};

export type ContactModalTab = "info" | "interactions" | "inventory";
