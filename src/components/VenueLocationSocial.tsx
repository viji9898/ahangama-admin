import { Row, Col, Card } from "antd";

export function VenueLocationSocial({ venue }: { venue: any }) {
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
            <b>Map URL:</b> {venue?.mapUrl}
          </div>
        </Col>
        <Col span={12}>
          <div>
            <b>Instagram URL:</b> {venue?.instagramUrl}
          </div>
          <div>
            <b>WhatsApp:</b> {venue?.whatsapp}
          </div>
        </Col>
      </Row>
    </Card>
  );
}
