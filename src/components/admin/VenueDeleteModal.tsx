import { Alert, Input, Modal, Space, Typography } from "antd";
import type { Venue } from "../../types/venue";

type Props = {
  open: boolean;
  venue?: Venue;
  confirmValue: string;
  deleting: boolean;
  onChangeConfirmValue: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function VenueDeleteModal({
  open,
  venue,
  confirmValue,
  deleting,
  onChangeConfirmValue,
  onCancel,
  onConfirm,
}: Props) {
  const confirmTarget = venue?.id || venue?.name || "";
  const canDelete = confirmValue.trim() === confirmTarget;

  return (
    <Modal
      title="Delete venue"
      open={open}
      onCancel={onCancel}
      onOk={onConfirm}
      okText="Delete venue"
      okButtonProps={{ danger: true, disabled: !canDelete, loading: deleting }}
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          This will soft-delete the venue and remove it from the active
          workspace.
        </Typography.Paragraph>
        <Alert
          type="warning"
          showIcon
          message="Type the venue ID to confirm"
          description={confirmTarget || "No venue selected"}
        />
        <Input
          value={confirmValue}
          onChange={(event) => onChangeConfirmValue(event.target.value)}
          placeholder={confirmTarget || "Venue ID"}
        />
      </Space>
    </Modal>
  );
}
