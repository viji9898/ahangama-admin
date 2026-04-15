import { Button, Empty, Space, Typography } from "antd";

type Props = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyVenueState({
  title,
  description,
  actionLabel,
  onAction,
}: Props) {
  return (
    <Space
      direction="vertical"
      size={12}
      style={{
        width: "100%",
        minHeight: 260,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} />
      <Typography.Title level={4} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
      <Typography.Paragraph
        type="secondary"
        style={{ margin: 0, textAlign: "center", maxWidth: 360 }}
      >
        {description}
      </Typography.Paragraph>
      {actionLabel && onAction ? (
        <Button type="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Space>
  );
}
