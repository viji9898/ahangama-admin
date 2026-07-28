import {
  BarChartOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  HomeOutlined,
  LinkOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  PhoneOutlined,
  QrcodeOutlined,
  ShopOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Button,
  Grid,
  Layout,
  Menu,
  Space,
  Typography,
  message,
} from "antd";
import "antd/dist/reset.css";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";

const STAY_ENQUIRIES_SUMMARY_ENDPOINT =
  "/.netlify/functions/api-stay-enquiries-list?summary=true";
const UNREAD_COUNT_EVENT = "stay-enquiries-unread-change";

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
    children: [
      { key: "/admin/pass-users/paid", label: "Paid Pass" },
      { key: "/admin/pass-users/hospo", label: "Hospo" },
      { key: "/admin/pass-users/circle", label: "Circle" },
      { key: "/admin/pass-users/guest-pass", label: "Guest Pass" },
    ],
  },
  {
    key: "/admin/call-logs",
    label: "Call Logs",
    icon: <PhoneOutlined />,
  },
  {
    key: "/admin/enquiries",
    label: "Enquiries",
    icon: <MessageOutlined />,
    children: [{ key: "/admin/enquiries/stays", label: "Stays" }],
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
      ? "/admin/pass-users/paid"
      : pathname;
  }

  if (pathname.startsWith("/admin/enquiries")) {
    return pathname === "/admin/enquiries"
      ? "/admin/enquiries/stays"
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
  const [unreadEnquiryCount, setUnreadEnquiryCount] = useState(0);

  const displayName = (user?.name || user?.email || "").toString();
  const isSmallScreen = !screens.md;
  const navCollapsed = !isSmallScreen && collapsed;
  const selectedKey = getSelectedKey(location.pathname);
  const menuItems = useMemo(
    () =>
      navItems.map((item) =>
        item.key === "/admin/enquiries"
          ? {
              ...item,
              label: (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>Enquiries</span>
                  {unreadEnquiryCount > 0 ? (
                    <Badge
                      count={unreadEnquiryCount}
                      overflowCount={99}
                      size="small"
                    />
                  ) : null}
                </span>
              ),
            }
          : item,
      ),
    [unreadEnquiryCount],
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadUnreadCount = async () => {
      try {
        const response = await fetch(STAY_ENQUIRIES_SUMMARY_ENDPOINT, {
          credentials: "include",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as {
          unreadCount?: number;
        };
        if (response.ok && Number.isFinite(payload.unreadCount)) {
          setUnreadEnquiryCount(Math.max(0, Number(payload.unreadCount)));
        }
      } catch (loadError) {
        if ((loadError as Error)?.name !== "AbortError") {
          console.error("Failed to load unread enquiry count", loadError);
        }
      }
    };

    const handleUnreadCountChange = (event: Event) => {
      const count = (event as CustomEvent<{ unreadCount?: number }>).detail
        ?.unreadCount;
      if (Number.isFinite(count)) {
        setUnreadEnquiryCount(Math.max(0, Number(count)));
      }
    };

    void loadUnreadCount();
    const intervalId = window.setInterval(() => void loadUnreadCount(), 60_000);
    window.addEventListener(UNREAD_COUNT_EVENT, handleUnreadCountChange);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener(UNREAD_COUNT_EVENT, handleUnreadCountChange);
    };
  }, []);

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
            defaultOpenKeys={[
              "/admin/events",
              "/admin/pass-users",
              "/admin/enquiries",
              "/ga-menu",
            ]}
            items={menuItems}
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
