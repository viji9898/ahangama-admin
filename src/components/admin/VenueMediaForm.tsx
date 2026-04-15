import { Col, Form, Input, Row, Space, Typography } from "antd";
import type { Venue } from "../../types/venue";
import { VenueMediaUploadField } from "./VenueMediaUploadField";
import { getVenueHeroImage } from "./venueAdminUtils";

type Props = {
  venue: Venue;
  onPatch: (patch: Partial<Venue>) => void;
};

export function VenueMediaForm({ venue, onPatch }: Props) {
  const venueId = String(venue.id || "").trim().toLowerCase() || undefined;

  return (
    <Space
      direction="vertical"
      size={16}
      style={{ width: "100%", paddingTop: 8 }}
    >
      <Typography.Text type="secondary">
        Upload directly to S3, then review the URLs below. Media changes are saved with the rest of the form.
      </Typography.Text>

      <Row gutter={[12, 12]}>
        <Col span={24}>
          <VenueMediaUploadField
            kind="image"
            venueId={venueId}
            value={getVenueHeroImage(venue) || undefined}
            onUploaded={(url) => onPatch({ image: url })}
          />
        </Col>
        <Col xs={24} md={12}>
          <VenueMediaUploadField
            kind="logo"
            venueId={venueId}
            value={venue.logo || undefined}
            onUploaded={(url) => onPatch({ logo: url })}
          />
        </Col>
        <Col xs={24} md={12}>
          <VenueMediaUploadField
            kind="ogImage"
            venueId={venueId}
            value={venue.ogImage || undefined}
            onUploaded={(url) => onPatch({ ogImage: url })}
          />
        </Col>
      </Row>

      <Form layout="vertical">
        <Form.Item label="Logo URL">
          <Input
            value={venue.logo || ""}
            onChange={(event) => onPatch({ logo: event.target.value })}
            placeholder="https://..."
          />
        </Form.Item>
        <Form.Item label="Hero image URL">
          <Input
            value={venue.image || ""}
            onChange={(event) => onPatch({ image: event.target.value })}
            placeholder="https://..."
          />
        </Form.Item>
        <Form.Item label="OG image URL">
          <Input
            value={venue.ogImage || ""}
            onChange={(event) => onPatch({ ogImage: event.target.value })}
            placeholder="https://..."
          />
        </Form.Item>
      </Form>
    </Space>
  );
}
