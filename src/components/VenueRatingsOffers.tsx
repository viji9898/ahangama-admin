import { Row, Col, Card } from "antd";

export function VenueRatingsOffers({ venue }: { venue: any }) {
  return (
    <Card title="Ratings & Offers" style={{ marginBottom: 16 }}>
      <Row gutter={32}>
        <Col span={12}>
          <div>
            <b>Stars:</b> {venue?.stars}
          </div>
          <div>
            <b>Reviews:</b> {venue?.reviews}
          </div>
          <div>
            <b>Discount:</b> {venue?.discount}
          </div>
          <div>
            <b>Card Perk:</b> {venue?.cardPerk}
          </div>
        </Col>
        <Col span={12}>
          <div>
            <b>Offers:</b>{" "}
            {Array.isArray(venue?.offers)
              ? (venue?.offers as string[]).join(", ")
              : (venue?.offers ?? "N/A")}
          </div>
        </Col>
      </Row>
    </Card>
  );
}
