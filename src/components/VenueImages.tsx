import { Row, Col, Card } from "antd";

export function VenueImages({ venue }: { venue: any }) {
  return (
    <Card title="Images" style={{ marginBottom: 16 }}>
      <Row gutter={16}>
        {venue?.logo && (
          <Col>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              Logo
            </div>
            <img
              src={venue.logo}
              alt="logo"
              style={{
                width: 64,
                height: 64,
                objectFit: "contain",
                borderRadius: 8,
                background: "#fff",
                border: "1px solid #eee",
              }}
            />
          </Col>
        )}
        {venue?.image && (
          <Col>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              Image
            </div>
            <img
              src={venue.image}
              alt="image"
              style={{
                width: 64,
                height: 64,
                objectFit: "cover",
                borderRadius: 8,
                background: "#fff",
                border: "1px solid #eee",
              }}
            />
          </Col>
        )}
        {venue?.ogImage && (
          <Col>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              OG Image
            </div>
            <img
              src={venue.ogImage}
              alt="ogImage"
              style={{
                width: 64,
                height: 64,
                objectFit: "cover",
                borderRadius: 8,
                background: "#fff",
                border: "1px solid #eee",
              }}
            />
          </Col>
        )}
      </Row>
    </Card>
  );
}
