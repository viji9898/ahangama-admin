import { Card, Col, Row, Space, Tag, Typography } from "antd";
import type {
  PartnerContact,
  PartnerInteraction,
  PartnerTouchpointInventory,
  TouchpointType,
} from "../../types/crm";
import type { ContactModalTab } from "./types";

type TouchpointOption = { label: string; value: TouchpointType };

type Props = {
  selectedContact: PartnerContact;
  interactions: PartnerInteraction[];
  interactionScope: "venue" | "contact";
  touchpoints: PartnerTouchpointInventory[];
  touchpointOptions: TouchpointOption[];
  onOpenTab: (tab: ContactModalTab) => void;
};

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString();
}

export default function ContactSummaryCards({
  selectedContact,
  interactions,
  interactionScope,
  touchpoints,
  touchpointOptions,
  onOpenTab,
}: Props) {
  const latestInteraction = interactions[0] || null;
  const totalInventoryUnits = touchpoints.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );
  const activeTouchpoints = touchpoints.filter((item) => Number(item.quantity || 0) > 0);
  const topTouchpointLabels = activeTouchpoints
    .slice(0, 3)
    .map(
      (item) =>
        touchpointOptions.find((option) => option.value === item.touchpointType)?.label ||
        item.touchpointType,
    );

  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} md={8}>
        <Card hoverable onClick={() => onOpenTab("info")} style={{ height: "100%" }}>
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Typography.Text strong>Contact Details</Typography.Text>
            <Space wrap>
              <Tag>{selectedContact.role}</Tag>
              {selectedContact.isPrimary ? <Tag color="gold">Primary</Tag> : null}
              {selectedContact.active ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>}
            </Space>
            <Typography.Text>{selectedContact.contactName}</Typography.Text>
            <Typography.Text type="secondary">
              {selectedContact.venueName || selectedContact.venueId}
            </Typography.Text>
            {selectedContact.email ? (
              <Typography.Text type="secondary">Email: {selectedContact.email}</Typography.Text>
            ) : null}
            {selectedContact.whatsapp ? (
              <Typography.Text type="secondary">
                WhatsApp: {selectedContact.whatsapp}
              </Typography.Text>
            ) : null}
            {!selectedContact.email && !selectedContact.whatsapp && !selectedContact.phone ? (
              <Typography.Text type="secondary">
                No direct contact methods saved yet
              </Typography.Text>
            ) : null}
            <Typography.Text type="secondary">Click to edit contact info</Typography.Text>
          </Space>
        </Card>
      </Col>

      <Col xs={24} md={8}>
        <Card
          hoverable
          onClick={() => onOpenTab("interactions")}
          style={{ height: "100%" }}
        >
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Typography.Text strong>Log Calls & Interactions</Typography.Text>
            <Typography.Text>
              {interactions.length} interaction{interactions.length === 1 ? "" : "s"}
            </Typography.Text>
            <Typography.Text type="secondary">
              Scope: {interactionScope === "contact" ? "Selected Contact" : "Venue"}
            </Typography.Text>
            {latestInteraction ? (
              <>
                <Typography.Text>{latestInteraction.summary}</Typography.Text>
                <Typography.Text type="secondary">
                  Last activity: {formatDate(latestInteraction.interactionAt)}
                </Typography.Text>
              </>
            ) : (
              <Typography.Text type="secondary">No interactions logged yet</Typography.Text>
            )}
            <Typography.Text type="secondary">Click to log calls and follow-ups</Typography.Text>
          </Space>
        </Card>
      </Col>

      <Col xs={24} md={8}>
        <Card hoverable onClick={() => onOpenTab("inventory")} style={{ height: "100%" }}>
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Typography.Text strong>Inventory Updates</Typography.Text>
            <Typography.Text>{totalInventoryUnits} total units tracked</Typography.Text>
            <Typography.Text type="secondary">
              {activeTouchpoints.length} touchpoint type
              {activeTouchpoints.length === 1 ? "" : "s"} with stock
            </Typography.Text>
            {topTouchpointLabels.length ? (
              <Typography.Text type="secondary">
                {topTouchpointLabels.join(", ")}
              </Typography.Text>
            ) : (
              <Typography.Text type="secondary">No inventory quantities saved yet</Typography.Text>
            )}
            <Typography.Text type="secondary">Click to update quantities</Typography.Text>
          </Space>
        </Card>
      </Col>
    </Row>
  );
}