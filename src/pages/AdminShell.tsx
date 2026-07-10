import {
  BarChartOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  HomeOutlined,
  LinkOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PhoneOutlined,
  QrcodeOutlined,
  ShopOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Grid, Layout, Menu, Space, Typography, message } from "antd";
import "antd/dist/reset.css";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/useAuth";

const navItems = [
  { key: "/admin", label: "Home", icon: <HomeOutlined /> },
  {
    key: "/admin/activity",
    label: "Recent Activity",
    icon: <ClockCircleOutlined />,
  },
  {
    key: "/admin/operations",
    label: "Daily Operations",
    icon: <ClockCircleOutlined />,
  },
  {
    key: "/admin/links",
    label: "IG Link Generator",
    icon: <LinkOutlined />,
  },
  { key: "/admin/qr-links", label: "QR Links", icon: <QrcodeOutlined /> },
  { key: "/admin/venues", label: "Venues", icon: <ShopOutlined /> },
  { key: "/admin/crm", label: "Partner CRM", icon: <TeamOutlined /> },
  {
    key: "/admin/travel-agents",
    label: "Travel Agents",
    icon: <TeamOutlined />,
  },
  {
    key: "/admin/pass-users",
    label: "Pass Users Details",
    icon: <UserOutlined />,
    children: [{ key: "/admin/pass-users/hospo", label: "Hospo" }],
  },
  {
    key: "/admin/call-logs",
    label: "Call Logs",
    icon: <PhoneOutlined />,
  },
  {
    key: "/admin/events",
    label: "Events",
    icon: <CalendarOutlined />,
    children: [
      { key: "/admin/events/add", label: "Add events" },
      { key: "/admin/events/list", label: "List all events" },
    ],
  },
  {
    key: "/ga-menu",
    label: "Analytics",
    icon: <BarChartOutlined />,
    children: [
      { key: "/ga", label: "Overview" },
      { key: "/ga/free-pass-scans", label: "All Free Pass Scans" },
    ],
  },
  { key: "/admin/qr", label: "QR Analytics", icon: <BarChartOutlined /> },
];

const getSelectedKey = (pathname: string) => {
  if (pathname.startsWith("/ga")) {
    return pathname === "/ga" ? "/ga" : pathname;
  }

  if (pathname.startsWith("/admin/events")) {
    return pathname === "/admin/events" ? "/admin/events/list" : pathname;
  }

  if (pathname.startsWith("/admin/pass-users")) {
    return pathname === "/admin/pass-users"
      ? "/admin/pass-users/hospo"
      : pathname;
  }

  return (
    navItems.find((item) =>
      item.key === "/admin"
        ? pathname === item.key
        : pathname.startsWith(item.key),
    )?.key || "/admin"
  );
};

export default function AdminShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const screens = Grid.useBreakpoint();
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const displayName = (user?.name || user?.email || "").toString();
  const isSmallScreen = !screens.md;
  const navCollapsed = !isSmallScreen && collapsed;
  const selectedKey = getSelectedKey(location.pathname);

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
          collapsed={!isSmallScreen && collapsed}
          collapsedWidth={88}
          trigger={null}
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
            <Space
              align="center"
              style={{ width: "100%", justifyContent: "space-between" }}
            >
              <Typography.Text style={{ color: "#fff", fontWeight: 600 }}>
                {navCollapsed ? "AA" : "Ahangama Admin"}
              </Typography.Text>
              {!isSmallScreen ? (
                <Button
                  type="text"
                  icon={
                    collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
                  }
                  onClick={() => setCollapsed((value) => !value)}
                  aria-label={
                    collapsed ? "Expand navigation" : "Collapse navigation"
                  }
                  style={{ color: "#fff" }}
                />
              ) : null}
            </Space>
          </div>

          <Menu
            theme="dark"
            mode={isSmallScreen ? "horizontal" : "inline"}
            inlineCollapsed={isSmallScreen ? undefined : collapsed}
            selectedKeys={[selectedKey]}
            defaultOpenKeys={["/admin/events", "/admin/pass-users", "/ga-menu"]}
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
            {displayName && !navCollapsed ? (
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
              icon={<LogoutOutlined />}
            >
              {navCollapsed && !isSmallScreen ? null : "Logout"}
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
