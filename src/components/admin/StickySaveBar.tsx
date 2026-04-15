import { Button, Card, Space, Tag, Typography } from "antd";

type Props = {
  dirty: boolean;
  saving: boolean;
  saveState: "idle" | "saving" | "saved";
  onCancel: () => void;
  onSave: () => void;
};

export function StickySaveBar({
  dirty,
  saving,
  saveState,
  onCancel,
  onSave,
}: Props) {
  const label = dirty
    ? "Unsaved changes"
    : saveState === "saved"
      ? "All changes saved"
      : "No changes";

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        paddingTop: 12,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0), rgba(250,250,249,0.98) 28%)",
      }}
    >
      <Card
        size="small"
        styles={{ body: { padding: 14 } }}
        style={{
          borderRadius: 18,
          border: dirty
            ? "1px solid rgba(217, 119, 6, 0.28)"
            : "1px solid rgba(15, 23, 42, 0.08)",
          boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
        }}
      >
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Space>
            <Tag
              color={
                dirty ? "gold" : saveState === "saved" ? "green" : "default"
              }
            >
              {label}
            </Tag>
            <Typography.Text type="secondary">
              {dirty
                ? "Review changes before publishing to the venue record."
                : "The editor is in sync with the selected venue."}
            </Typography.Text>
          </Space>

          <Space>
            <Button onClick={onCancel} disabled={!dirty || saving}>
              Cancel
            </Button>
            <Button
              type="primary"
              onClick={onSave}
              loading={saving}
              disabled={!dirty}
            >
              Save Changes
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
}
