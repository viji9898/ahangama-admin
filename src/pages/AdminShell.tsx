import { Button, Grid, Layout, Menu, Space, Typography, message } from "antd";
import "antd/dist/reset.css";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/useAuth";

const navItems = [
  { key: "/admin", label: "Home" },
  { key: "/admin/activity", label: "Recent Activity" },
  { key: "/admin/links", label: "IG Link Generator" },
  { key: "/admin/qr-links", label: "QR Links" },
  { key: "/admin/venues", label: "Venues" },
  { key: "/admin/crm", label: "CRM" },
  { key: "/admin/qr", label: "QR Analytics" },
];

export default function AdminShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const screens = Grid.useBreakpoint();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = (user?.name || user?.email || "").toString();
  const isSmallScreen = !screens.md;
  const selectedKey =
    navItems.find((item) =>
      item.key === "/admin"
        ? location.pathname === item.key
        : location.pathname.startsWith(item.key),
    )?.key || "/admin";

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
      <Layout
        style={{
          minHeight: "100vh",
          flexDirection: isSmallScreen ? "column" : "row",
        }}
      >
        <Layout.Sider
          theme="dark"
          width={260}
          style={{
            background: "#0f172a",
            flex: isSmallScreen ? "0 0 auto" : undefined,
            width: isSmallScreen ? "100%" : undefined,
            maxWidth: isSmallScreen ? "100%" : undefined,
          }}
        >
          <div
            style={{
              padding: 24,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Typography.Text style={{ color: "#fff", fontWeight: 600 }}>
              Ahangama Admin
            </Typography.Text>
          </div>

          <Menu
            theme="dark"
            mode={isSmallScreen ? "horizontal" : "inline"}
            selectedKeys={[selectedKey]}
            items={navItems}
            onClick={({ key }) => navigate(key)}
            style={{
              borderInlineEnd: 0,
              flexWrap: isSmallScreen ? "wrap" : undefined,
            }}
          />

          <Space
            direction={isSmallScreen ? "horizontal" : "vertical"}
            size={12}
            style={{
              padding: 24,
              width: "100%",
              justifyContent: "space-between",
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {displayName ? (
              <Typography.Text style={{ color: "#fff" }}>
                {displayName}
              </Typography.Text>
            ) : (
              <span />
            )}
            <Button
              type="link"
              onClick={logout}
              loading={loggingOut}
              style={{ color: "#fff", padding: 0 }}
            >
              Logout
            </Button>
          </Space>
        </Layout.Sider>

        <Layout>
          <Layout.Content
            style={{
              padding: 24,
              minWidth: 0,
              overflow: "auto",
            }}
          >
            <Outlet />
          </Layout.Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
