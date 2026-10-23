import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Layout, Space, Typography } from "antd";
import { Link } from "react-router-dom";

export default function Midigama() {
  return (
    <Layout
      style={{
        minHeight: "100vh",
        padding: "clamp(24px, 7vw, 88px)",
        background: "#f5f1e8",
      }}
    >
      <main style={{ width: "min(100%, 960px)", margin: "0 auto" }}>
        <Space direction="vertical" size={32}>
          <Link to="/admin">
            <Button type="text" icon={<ArrowLeftOutlined />}>
              Back to admin
            </Button>
          </Link>
          <div>
            <Typography.Text
              style={{
                color: "#9a5b3a",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Private workspace
            </Typography.Text>
            <Typography.Title
              level={1}
              style={{ margin: "8px 0 12px", color: "#24362f" }}
            >
              Midigama
            </Typography.Title>
            <Typography.Paragraph
              style={{ maxWidth: 560, color: "#59645f", fontSize: 17 }}
            >
              This page is restricted to the authorized Midigama account.
            </Typography.Paragraph>
          </div>
        </Space>
      </main>
    </Layout>
  );
}