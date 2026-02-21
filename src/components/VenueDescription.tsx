import { Row, Col, Card } from "antd";

export function VenueDescription({ venue }: { venue: any }) {
  return (
    <Card title="Description" style={{ marginBottom: 16 }}>
      <Row gutter={32}>
        <Col span={12}>
          <div>
            <b>Excerpt:</b> {venue?.excerpt}
          </div>
          <div>
            <b>Description:</b> {venue?.description}
          </div>
          <div>
            <b>Best For:</b> {venue?.bestFor?.join(", ")}
          </div>
        </Col>
        <Col span={12}>
          <div>
            <b>How To Claim:</b> {venue?.howToClaim}
          </div>
          <div>
            <b>Restrictions:</b> {venue?.restrictions}
          </div>
        </Col>
      </Row>
    </Card>
  );
}
