import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import type { Venue } from "../../types/venue";
import {
  formatDateTime,
  getVenueCategories,
  getVenueHeroImage,
  getVenueOffersArray,
} from "./venueAdminUtils";

type Props = {
  venue?: Venue;
  onPreview: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCreate: () => void;
};

export function VenueFocusPanel({
  venue,
  onPreview,
  onDuplicate,
  onDelete,
  onCreate,
}: Props) {
  if (!venue) {
    return (
      <Card style={{ borderRadius: 24 }}>
        <div style={{ minHeight: 540, display: "grid", placeItems: "center" }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Select a venue from the browser to open its editorial focus panel."
          >
            <Button type="primary" onClick={onCreate}>
              Create New Venue
            </Button>
          </Empty>
        </div>
      </Card>
    );
  }

  const heroImage = getVenueHeroImage(venue);
  const categories = getVenueCategories(venue);
  const offers = getVenueOffersArray(venue.offers);

  return (
    <Card
      styles={{ body: { padding: 20 } }}
      style={{
        borderRadius: 24,
        border: "1px solid rgba(15, 23, 42, 0.06)",
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
      }}
    >
      <Space direction="vertical" size={18} style={{ width: "100%" }}>
        <div
          style={{
            height: 280,
            borderRadius: 22,
            overflow: "hidden",
            background: "rgba(226, 232, 240, 0.65)",
            display: "grid",
            placeItems: "center",
          }}
        >
          {heroImage ? (
            <img
              src={heroImage}
              alt={venue.name || "Venue hero"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Typography.Text type="secondary">
              Missing image/media
            </Typography.Text>
          )}
        </div>

        <Row justify="space-between" align="top" gutter={[12, 12]}>
          <Col flex="auto">
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              <Space size={[8, 8]} wrap>
                <Badge
                  status={(venue.live ?? true) ? "success" : "default"}
                  text={(venue.live ?? true) ? "Live" : "Coming soon"}
                />
                {venue.status ? <Tag>{venue.status}</Tag> : null}
                {venue.area ? <Tag bordered={false}>{venue.area}</Tag> : null}
                {categories.map((category) => (
                  <Tag key={category} color="gold" bordered={false}>
                    {category}
                  </Tag>
                ))}
              </Space>

              <div>
                <Typography.Title level={2} style={{ margin: 0 }}>
                  {venue.name || "Untitled venue"}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {venue.destinationSlug || "destination"} /{" "}
                  {venue.slug || venue.id || "identifier"}
                </Typography.Text>
              </div>

              <Typography.Paragraph style={{ margin: 0 }}>
                {venue.excerpt ||
                  "No excerpt yet. Add a concise editorial summary in the editor panel."}
              </Typography.Paragraph>

              <Typography.Text type="secondary">
                Updated {formatDateTime(venue.updatedAt || venue.updated_at)}
              </Typography.Text>
            </Space>
          </Col>

          <Col>
            <Space wrap>
              <Button onClick={onPreview} disabled={!venue.mapUrl}>
                Preview
              </Button>
              <Button onClick={onDuplicate}>Duplicate</Button>
              <Button danger onClick={onDelete}>
                Delete
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}>
            <Card
              size="small"
              styles={{ body: { padding: 14 } }}
              style={{ borderRadius: 16 }}
            >
              <Statistic title="Stars" value={venue.stars ?? 0} precision={1} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card
              size="small"
              styles={{ body: { padding: 14 } }}
              style={{ borderRadius: 16 }}
            >
              <Statistic title="Reviews" value={venue.reviews ?? 0} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card
              size="small"
              styles={{ body: { padding: 14 } }}
              style={{ borderRadius: 16 }}
            >
              <Statistic title="Priority" value={venue.priorityScore ?? 0} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card
              size="small"
              styles={{ body: { padding: 14 } }}
              style={{ borderRadius: 16 }}
            >
              <Statistic
                title="Pass priority"
                value={venue.passPriority ?? 0}
              />
            </Card>
          </Col>
        </Row>

        <Card
          size="small"
          styles={{ body: { padding: 18 } }}
          style={{ borderRadius: 18, background: "rgba(248,250,252,0.72)" }}
        >
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Typography.Text type="secondary">Quick summary</Typography.Text>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Typography.Text strong>Best for</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Space size={[6, 6]} wrap>
                    {(venue.bestFor || []).length ? (
                      (venue.bestFor || []).map((item) => (
                        <Tag key={item}>{item}</Tag>
                      ))
                    ) : (
                      <Typography.Text type="secondary">
                        No best-for tags yet
                      </Typography.Text>
                    )}
                  </Space>
                </div>
              </Col>
              <Col span={12}>
                <Typography.Text strong>Offers</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Space size={[6, 6]} wrap>
                    {offers.length ? (
                      offers.map((item) => (
                        <Tag key={item} color="green">
                          {item}
                        </Tag>
                      ))
                    ) : (
                      <Typography.Text type="secondary">
                        No offers configured
                      </Typography.Text>
                    )}
                  </Space>
                </div>
              </Col>
            </Row>
          </Space>
        </Card>
      </Space>
    </Card>
  );
}
