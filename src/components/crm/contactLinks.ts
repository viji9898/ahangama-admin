export function makeWhatsAppUrl(value?: string | null) {
  const normalized = String(value || "").replace(/[^\d+]/g, "").trim();
  if (!normalized) return null;
  const phone = normalized.startsWith("+") ? normalized.slice(1) : normalized;
  return `https://wa.me/${encodeURIComponent(phone)}`;
}

export function makeGmailComposeUrl(email?: string | null) {
  const normalized = String(email || "").trim();
  if (!normalized) return null;
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(normalized)}`;
}