export function makeWhatsAppUrl(value?: string | null) {
  const normalized = String(value || "")
    .replace(/[^\d+]/g, "")
    .trim();
  if (!normalized) return null;
  const phone = normalized.startsWith("+") ? normalized.slice(1) : normalized;
  return `https://wa.me/${encodeURIComponent(phone)}`;
}

export function makeWhatsAppUrlWithMessage(
  value?: string | null,
  message?: string | null,
) {
  const baseUrl = makeWhatsAppUrl(value);
  const normalizedMessage = String(message || "").trim();

  if (!baseUrl) return null;
  if (!normalizedMessage) return baseUrl;

  return `${baseUrl}?text=${encodeURIComponent(normalizedMessage)}`;
}

export function makeGmailComposeUrl(email?: string | null) {
  const normalized = String(email || "").trim();
  if (!normalized) return null;
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(normalized)}`;
}
