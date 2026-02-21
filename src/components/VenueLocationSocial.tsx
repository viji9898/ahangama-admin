import { Row, Col, Card } from "antd";

export function VenueLocationSocial({ venue }: { venue: any }) {
  const toNumber = (v: unknown) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };

  const lat = toNumber(venue?.lat);
  const lng = toNumber(venue?.lng);
  const hasCoords =
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  const mapEmbedUrl = (() => {
    if (!hasCoords) return "";
    return `https://www.google.com/maps?q=${encodeURIComponent(
      `${lat},${lng}`,
    )}&z=16&output=embed`;
  })();

  return (
    <Card title="Location & Social" style={{ marginBottom: 16 }}>
      <Row gutter={32}>
        <Col span={12}>
          <div>
            <b>Lat:</b> {venue?.lat}
          </div>
          <div>
            <b>Lng:</b> {venue?.lng}
          </div>
          <div>
            <b>Map URL:</b>{" "}
            {venue?.mapUrl ? (
              <a href={venue.mapUrl} target="_blank" rel="noreferrer">
                {venue.mapUrl}
              </a>
            ) : (
              "—"
            )}
          </div>
        </Col>
        <Col span={12}>
          <div>
            <b>Instagram URL:</b>{" "}
            {venue?.instagramUrl ? (
              <a href={venue.instagramUrl} target="_blank" rel="noreferrer">
                {venue.instagramUrl}
              </a>
            ) : (
              "—"
            )}
          </div>
          <div>
            <b>WhatsApp:</b> {venue?.whatsapp || "—"}
          </div>
        </Col>

        <Col span={24} style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Map</div>
          {hasCoords ? (
            <iframe
              title="Venue map"
              src={mapEmbedUrl}
              style={{
                width: "100%",
                height: 320,
                border: 0,
                borderRadius: 8,
              }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div style={{ color: "#888" }}>No coordinates available.</div>
          )}
        </Col>
      </Row>
    </Card>
  );
}
