import { Row, Col, Card } from "antd";

export function VenueBasicInfo({ venue }: { venue: any }) {
  return (
    <Card title="Basic Info" style={{ marginBottom: 16 }}>
      <Row gutter={32}>
        <Col span={12}>
          <div>
            <b>ID:</b> {venue?.id}
          </div>
          <div>
            <b>Destination Slug:</b> {venue?.destinationSlug}
          </div>
          <div>
            <b>Name:</b> {venue?.name}
          </div>
          <div>
            <b>Slug:</b> {venue?.slug}
          </div>
        </Col>
        <Col span={12}>
          <div>
            <b>Status:</b> {venue?.status}
          </div>
          <div>
            <b>Area:</b> {venue?.area}
          </div>
          <div>
            <b>Updated At:</b> {venue?.updatedAt || venue?.updated_at}
          </div>
          <div>
            <b>Created At:</b> {venue?.createdAt || venue?.created_at}
          </div>
        </Col>
      </Row>
    </Card>
  );
}
