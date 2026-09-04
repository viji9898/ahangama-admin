import {
  BarChartOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  HomeOutlined,
  LinkOutlined,
  LogoutOutlined,
  MailOutlined,
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
const RETREAT_ENQUIRIES_SUMMARY_ENDPOINT =
  "/.netlify/functions/api-retreat-enquiries-list?summary=true";
const TRANSPORT_ENQUIRIES_SUMMARY_ENDPOINT =
  "/.netlify/functions/api-transport-enquiries-list?summary=true";
const STAY_UNREAD_COUNT_EVENT = "stay-enquiries-unread-change";
const RETREAT_UNREAD_COUNT_EVENT = "retreat-enquiries-unread-change";
const TRANSPORT_UNREAD_COUNT_EVENT = "transport-enquiries-unread-change";

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
    key: "/admin/newsletters",
    label: "Newsletters",
    icon: <MailOutlined />,
  },
  {
    key: "/admin/links",
    label: "IG Link Generator",
    icon: <LinkOutlined />,
  },
  { key: "/admin/qr-links", label: "QR Links", icon: <QrcodeOutlined /> },
  {
    key: "/admin/venues-menu",
    label: "Venues",
    icon: <ShopOutlined />,
    children: [
      { key: "/admin/venues", label: "All Venues" },
      { key: "/admin/venues/contact-info", label: "Contact Info" },
    ],
  },
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
    children: [
      { key: "/admin/enquiries/stays", label: "Stays" },
      { key: "/admin/enquiries/retreats", label: "Retreats" },
      { key: "/admin/enquiries/transport", label: "Transport" },
    ],
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
      { key: "/ga/guide-engagement", label: "Guide Engagement" },
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

  if (pathname.startsWith("/admin/venues")) {
    return pathname === "/admin/venues" ? "/admin/venues" : pathname;
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
  const [unreadStayCount, setUnreadStayCount] = useState(0);
  const [unreadRetreatCount, setUnreadRetreatCount] = useState(0);
  const [unreadTransportCount, setUnreadTransportCount] = useState(0);

  const displayName = (user?.name || user?.email || "").toString();
  const isSmallScreen = !screens.md;
  const navCollapsed = !isSmallScreen && collapsed;
  const selectedKey = getSelectedKey(location.pathname);
  const unreadEnquiryCount =
    unreadStayCount + unreadRetreatCount + unreadTransportCount;
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

    const loadUnreadCounts = async () => {
      try {
        const [stayResponse, retreatResponse, transportResponse] =
          await Promise.all([
            fetch(STAY_ENQUIRIES_SUMMARY_ENDPOINT, {
              credentials: "include",
              signal: controller.signal,
            }),
            fetch(RETREAT_ENQUIRIES_SUMMARY_ENDPOINT, {
              credentials: "include",
              signal: controller.signal,
            }),
            fetch(TRANSPORT_ENQUIRIES_SUMMARY_ENDPOINT, {
              credentials: "include",
              signal: controller.signal,
            }),
          ]);
        const [stayPayload, retreatPayload, transportPayload] =
          (await Promise.all([
            stayResponse.json().catch(() => ({})),
            retreatResponse.json().catch(() => ({})),
            transportResponse.json().catch(() => ({})),
          ])) as [
            { unreadCount?: number },
            { unreadCount?: number },
            { unreadCount?: number },
          ];
        if (stayResponse.ok && Number.isFinite(stayPayload.unreadCount)) {
          setUnreadStayCount(Math.max(0, Number(stayPayload.unreadCount)));
        }
        if (retreatResponse.ok && Number.isFinite(retreatPayload.unreadCount)) {
          setUnreadRetreatCount(
            Math.max(0, Number(retreatPayload.unreadCount)),
          );
        }
        if (
          transportResponse.ok &&
          Number.isFinite(transportPayload.unreadCount)
        ) {
          setUnreadTransportCount(
            Math.max(0, Number(transportPayload.unreadCount)),
          );
        }
      } catch (loadError) {
        if ((loadError as Error)?.name !== "AbortError") {
          console.error("Failed to load unread enquiry count", loadError);
        }
      }
    };

    const readEventCount = (event: Event) => {
      const count = (event as CustomEvent<{ unreadCount?: number }>).detail
        ?.unreadCount;
      return Number.isFinite(count) ? Math.max(0, Number(count)) : null;
    };
    const handleStayUnreadCountChange = (event: Event) => {
      const count = readEventCount(event);
      if (count !== null) setUnreadStayCount(count);
    };
    const handleRetreatUnreadCountChange = (event: Event) => {
      const count = readEventCount(event);
      if (count !== null) setUnreadRetreatCount(count);
    };
    const handleTransportUnreadCountChange = (event: Event) => {
      const count = readEventCount(event);
      if (count !== null) setUnreadTransportCount(count);
    };

    void loadUnreadCounts();
    const intervalId = window.setInterval(
      () => void loadUnreadCounts(),
      60_000,
    );
    window.addEventListener(
      STAY_UNREAD_COUNT_EVENT,
      handleStayUnreadCountChange,
    );
    window.addEventListener(
      RETREAT_UNREAD_COUNT_EVENT,
      handleRetreatUnreadCountChange,
    );
    window.addEventListener(
      TRANSPORT_UNREAD_COUNT_EVENT,
      handleTransportUnreadCountChange,
    );

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener(
        STAY_UNREAD_COUNT_EVENT,
        handleStayUnreadCountChange,
      );
      window.removeEventListener(
        RETREAT_UNREAD_COUNT_EVENT,
        handleRetreatUnreadCountChange,
      );
      window.removeEventListener(
        TRANSPORT_UNREAD_COUNT_EVENT,
        handleTransportUnreadCountChange,
      );
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
            {...(!isSmallScreen ? { inlineCollapsed: collapsed } : {})}
            selectedKeys={[selectedKey]}
            defaultOpenKeys={[
              "/admin/events",
              "/admin/pass-users",
              "/admin/enquiries",
              "/admin/venues-menu",
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
            orientation={isSmallScreen ? "horizontal" : "vertical"}
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
