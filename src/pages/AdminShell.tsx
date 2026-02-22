import { Layout, Space, Typography } from "antd";
import "antd/dist/reset.css";
import { Link, Outlet, useLocation } from "react-router-dom";

export default function AdminShell() {
  const location = useLocation();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography.Text style={{ color: "#fff", fontWeight: 600 }}>
          Ahangama Admin
        </Typography.Text>
        <Space size={16}>
          <Link
            to="/admin"
            style={{
              color: "#fff",
              textDecoration: location.pathname === "/admin" ? "underline" : "none",
            }}
          >
            List All Venues
          </Link>
        </Space>
      </Layout.Header>

      <Layout.Content style={{ padding: 24 }}>
        <Outlet />
      </Layout.Content>
    </Layout>
  );
}
