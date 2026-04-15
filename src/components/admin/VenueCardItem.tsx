import { Badge, Card, Space, Tag, Typography } from "antd";
import type { Venue } from "../../types/venue";
import {
  getVenueCategories,
  getVenueHeroImage,
  normalizeText,
} from "./venueAdminUtils";

type Props = {
  venue: Venue;
  isActive: boolean;
  onSelect: () => void;
};

export function VenueCardItem({ venue, isActive, onSelect }: Props) {
  const previewImage = getVenueHeroImage(venue);
  const categories = getVenueCategories(venue).slice(0, 2);

  return (
    <div onClick={onSelect} style={{ cursor: "pointer" }}>
      <Card
        hoverable
        styles={{ body: { padding: 16 } }}
        style={{
          borderRadius: 18,
          border: isActive
            ? "1px solid rgba(15, 23, 42, 0.28)"
            : "1px solid rgba(15, 23, 42, 0.08)",
          background: isActive
            ? "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))"
            : "rgba(255,255,255,0.88)",
          boxShadow: isActive
            ? "0 16px 32px rgba(15, 23, 42, 0.10)"
            : "0 10px 24px rgba(15, 23, 42, 0.05)",
        }}
      >
        <Space align="start" size={14} style={{ width: "100%" }}>
          {previewImage ? (
            <img
              src={previewImage}
              alt={venue.name || "Venue"}
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background:
                  "linear-gradient(135deg, rgba(226,232,240,0.95), rgba(248,250,252,0.98))",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                color: "#475569",
                flexShrink: 0,
              }}
            >
              {(venue.name || "V").slice(0, 1).toUpperCase()}
            </div>
          )}

          <Space direction="vertical" size={6} style={{ width: "100%" }}>
            <Space
              size={8}
              wrap
              style={{ justifyContent: "space-between", width: "100%" }}
            >
              <Badge
                status={(venue.live ?? true) ? "success" : "default"}
                text={(venue.live ?? true) ? "Live" : "Coming soon"}
              />
              {venue.area ? (
                <Typography.Text type="secondary">{venue.area}</Typography.Text>
              ) : null}
            </Space>

            <div>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {venue.name || "Untitled venue"}
              </Typography.Title>
              <Typography.Text type="secondary">
                {normalizeText(venue.slug) ||
                  normalizeText(venue.id) ||
                  "No identifier"}
              </Typography.Text>
            </div>

            <Space size={[6, 6]} wrap>
              {categories.map((category) => (
                <Tag key={category} bordered={false} color="gold">
                  {category}
                </Tag>
              ))}
              {venue.status ? <Tag bordered={false}>{venue.status}</Tag> : null}
            </Space>
          </Space>
        </Space>
      </Card>
    </div>
  );
}
