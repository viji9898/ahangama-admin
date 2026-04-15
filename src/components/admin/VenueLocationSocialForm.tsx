import { Form, Input, InputNumber, Row, Col } from "antd";
import type { Venue } from "../../types/venue";
import { getVenueInstagramValue } from "./venueAdminUtils";

type Props = {
  venue: Venue;
  onPatch: (patch: Partial<Venue>) => void;
};

export function VenueLocationSocialForm({ venue, onPatch }: Props) {
  return (
    <Form layout="vertical" style={{ paddingTop: 8 }}>
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item label="Latitude">
            <InputNumber
              controls={false}
              style={{ width: "100%" }}
              value={venue.lat ?? null}
              onChange={(value) =>
                onPatch({ lat: value === null ? undefined : Number(value) })
              }
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Longitude">
            <InputNumber
              controls={false}
              style={{ width: "100%" }}
              value={venue.lng ?? null}
              onChange={(value) =>
                onPatch({ lng: value === null ? undefined : Number(value) })
              }
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Map URL">
        <Input
          value={venue.mapUrl || ""}
          onChange={(event) => onPatch({ mapUrl: event.target.value })}
          placeholder="https://maps.app.goo.gl/..."
        />
      </Form.Item>

      <Form.Item label="Google Place ID">
        <Input
          value={venue.googlePlaceId || ""}
          onChange={(event) => onPatch({ googlePlaceId: event.target.value })}
          placeholder="ChIJ..."
        />
      </Form.Item>

      <Row gutter={12}>
        <Col span={12}>
          <Form.Item label="WhatsApp">
            <Input
              value={venue.whatsapp || ""}
              onChange={(event) => onPatch({ whatsapp: event.target.value })}
              placeholder="9477..."
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Email">
            <Input
              value={venue.email || ""}
              onChange={(event) => onPatch({ email: event.target.value })}
              placeholder="info@venue.com"
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Instagram">
        <Input
          value={getVenueInstagramValue(venue)}
          onChange={(event) =>
            onPatch({
              instagram: event.target.value,
              instagramUrl: event.target.value,
            })
          }
          placeholder="@venue or https://instagram.com/..."
        />
      </Form.Item>
    </Form>
  );
}
