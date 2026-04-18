import { Button, Layout, Space, Typography, message } from "antd";
import "antd/dist/reset.css";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/useAuth";

export default function AdminShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = (user?.name || user?.email || "").toString();

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/.netlify/functions/auth-logout", {
        method: "POST",
        credentials: "include",
      });
      navigate("/", { replace: true });
    } catch (e) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#0f172a",
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
              textDecoration:
                location.pathname === "/admin" ? "underline" : "none",
            }}
          >
            Home
          </Link>
          <Link
            to="/admin/venues"
            style={{
              color: "#fff",
              textDecoration: location.pathname.startsWith("/admin/venues")
                ? "underline"
                : "none",
            }}
          >
            Venues
          </Link>
          <Link
            to="/admin/qr"
            style={{
              color: "#fff",
              textDecoration: location.pathname.startsWith("/admin/qr")
                ? "underline"
                : "none",
            }}
          >
            QR Analytics
          </Link>
          {displayName ? (
            <Typography.Text style={{ color: "#fff" }}>
              {displayName}
            </Typography.Text>
          ) : null}
          <Button
            type="link"
            onClick={logout}
            loading={loggingOut}
            style={{ color: "#fff", padding: 0 }}
          >
            Logout
          </Button>
        </Space>
      </Layout.Header>

      <Layout.Content style={{ padding: 24 }}>
        <Outlet />
      </Layout.Content>
    </Layout>
  );
}
