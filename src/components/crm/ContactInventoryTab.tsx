import { Button, InputNumber, List, Space, Typography } from "antd";
import type {
  PartnerTouchpointInventory,
  TouchpointType,
} from "../../types/crm";

type Props = {
  activeVenueId: string | null;
  touchpointOptions: { label: string; value: TouchpointType }[];
  touchpointByType: Map<TouchpointType, PartnerTouchpointInventory>;
  touchpointDraft: Partial<Record<TouchpointType, number>>;
  touchpointSavingType: TouchpointType | null;
  onTouchpointChange: (touchpointType: TouchpointType, quantity: number) => void;
  onSaveTouchpoint: (touchpointType: TouchpointType, quantity: number) => void;
};

export default function ContactInventoryTab({
  activeVenueId,
  touchpointOptions,
  touchpointByType,
  touchpointDraft,
  touchpointSavingType,
  onTouchpointChange,
  onSaveTouchpoint,
}: Props) {
  if (!activeVenueId) {
    return (
      <Typography.Text type="secondary">
        Select a venue/contact to manage touchpoint counts.
      </Typography.Text>
    );
  }

  return (
    <List
      dataSource={touchpointOptions}
      renderItem={(item) => {
        const existing = touchpointByType.get(item.value);
        return (
          <List.Item
            actions={[
              <Button
                key="save"
                type="link"
                loading={touchpointSavingType === item.value}
                onClick={() => {
                  const parsed = Number(touchpointDraft[item.value] || 0);
                  onSaveTouchpoint(item.value, parsed);
                }}
              >
                Save
              </Button>,
            ]}
          >
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Text>{item.label}</Typography.Text>
              <InputNumber
                min={0}
                precision={0}
                value={touchpointDraft[item.value] ?? existing?.quantity ?? 0}
                onChange={(value) => onTouchpointChange(item.value, Number(value || 0))}
              />
            </Space>
          </List.Item>
        );
      }}
    />
  );
}