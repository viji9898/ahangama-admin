import {
  Card,
  Form,
  Input,
  InputNumber,
  Row,
  Col,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import { EDITORIAL_TAGS } from "../../constants/editorialTags";
import type { Venue } from "../../types/venue";
import {
  getVenuePrimaryCategory,
  VENUE_STATUS_OPTIONS,
} from "./venueAdminUtils";

type Props = {
  venue: Venue;
  categoryOptions: Array<{ label: string; value: string }>;
  onPatch: (patch: Partial<Venue>) => void;
};

export function VenueOverviewForm({ venue, categoryOptions, onPatch }: Props) {
  return (
    <Form layout="vertical" style={{ paddingTop: 8 }}>
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item label="Venue name">
            <Input
              value={venue.name || ""}
              onChange={(event) => onPatch({ name: event.target.value })}
              placeholder="Venue name"
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Destination slug">
            <Input
              value={venue.destinationSlug || ""}
              onChange={(event) =>
                onPatch({ destinationSlug: event.target.value })
              }
              placeholder="ahangama"
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={12}>
          <Form.Item label="Slug">
            <Input
              value={venue.slug || ""}
              onChange={(event) => onPatch({ slug: event.target.value })}
              placeholder="venue-slug"
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Category">
            <Select
              value={getVenuePrimaryCategory(venue) || undefined}
              options={categoryOptions}
              placeholder="Select category"
              onChange={(value) =>
                onPatch({ category: value, categories: value ? [value] : [] })
              }
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={12}>
          <Form.Item label="Area">
            <Input
              value={venue.area || ""}
              onChange={(event) => onPatch({ area: event.target.value })}
              placeholder="Ahangama"
            />
          </Form.Item>
        </Col>
      </Row>

      <Card size="small" title="Visibility" style={{ marginBottom: 16, borderRadius: 18 }}>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item label="Status" style={{ marginBottom: 0 }}>
              <Select
                value={venue.status || "draft"}
                options={VENUE_STATUS_OPTIONS}
                onChange={(value) => onPatch({ status: value })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Space style={{ minHeight: 56 }}>
              <Typography.Text strong>Live</Typography.Text>
              <Switch
                checked={venue.live ?? false}
                onChange={(checked) => onPatch({ live: checked })}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      <Space size={24} style={{ marginBottom: 16 }} wrap>
        <Space>
          <Typography.Text strong>Pass venue</Typography.Text>
          <Switch
            checked={venue.isPassVenue ?? false}
            onChange={(checked) => onPatch({ isPassVenue: checked })}
          />
        </Space>
        <Space>
          <Typography.Text strong>Staff pick</Typography.Text>
          <Switch
            checked={venue.staffPick ?? false}
            onChange={(checked) => onPatch({ staffPick: checked })}
          />
        </Space>
        <Space>
          <Typography.Text strong>Featured</Typography.Text>
          <Switch
            checked={venue.isFeatured ?? false}
            onChange={(checked) => onPatch({ isFeatured: checked })}
          />
        </Space>
      </Space>

      <Row gutter={12}>
        <Col span={12}>
          <Form.Item label="Priority score">
            <InputNumber
              value={venue.priorityScore ?? 0}
              min={0}
              controls={false}
              style={{ width: "100%" }}
              onChange={(value) =>
                onPatch({ priorityScore: Number(value ?? 0) })
              }
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Pass priority">
            <InputNumber
              value={venue.passPriority ?? 0}
              min={0}
              controls={false}
              style={{ width: "100%" }}
              onChange={(value) =>
                onPatch({ passPriority: Number(value ?? 0) })
              }
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Editorial tags">
        <Select
          mode="multiple"
          allowClear
          value={venue.editorialTags || []}
          options={EDITORIAL_TAGS.map((tag) => ({ label: tag, value: tag }))}
          onChange={(value) => onPatch({ editorialTags: value })}
          placeholder="Choose editorial tags"
        />
      </Form.Item>
    </Form>
  );
}
