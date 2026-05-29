import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import type { Venue } from "../types/venue";

const LIST_ENDPOINT = "/.netlify/functions/api-venues-list";

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 999,
        border: "1px solid rgba(15, 23, 42, 0.08)",
        background: "rgba(255, 255, 255, 0.78)",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        {label}
      </Typography.Text>
      <Typography.Text
        style={{
          fontSize: 18,
          lineHeight: 1,
          fontWeight: 700,
          color: accent,
        }}
      >
        {value}
      </Typography.Text>
    </div>
  );
}

function WorkspaceCard({
  title,
  description,
  to,
  cta,
}: {
  title: string;
  description: string;
  to: string;
  cta: string;
}) {
  return (
    <Card
      styles={{ body: { padding: 20 } }}
      style={{
        height: "100%",
        borderRadius: 20,
        border: "1px solid rgba(15, 23, 42, 0.06)",
        boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
      }}
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          {description}
        </Typography.Paragraph>
        <Link to={to}>
          <Button type="primary">{cta}</Button>
        </Link>
      </Space>
    </Card>
  );
}

export default function AdminHome() {
  const { user } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchVenues = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(LIST_ENDPOINT, {
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || `Failed (${response.status})`);
        }

        setVenues(Array.isArray(data?.venues) ? data.venues : []);
      } catch (fetchError) {
        setError(String((fetchError as Error)?.message || fetchError));
      } finally {
        setLoading(false);
      }
    };

    void fetchVenues();
  }, []);

  const liveCount = venues.filter(
    (venue) => (venue.live ?? true) === true,
  ).length;
  const comingSoonCount = venues.filter((venue) => venue.live === false).length;
  const staffPickCount = venues.filter(
    (venue) => venue.staffPick === true,
  ).length;

  const categorySummary = useMemo(() => {
    const counts = new Map<string, number>();

    for (const venue of venues) {
      if ((venue.live ?? true) !== true) continue;
      for (const category of Array.isArray(venue.categories)
        ? venue.categories
        : []) {
        const key = String(category).trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [venues]);

  const displayName = (user?.name || user?.email || "team").toString();
  const workspaceCards = [
    {
      title: "Venue management",
      description:
        "Create, edit, review, and publish venue listings across the directory.",
      to: "/admin/venues",
      cta: "Open venues",
    },
    {
      title: "Partner CRM",
      description:
        "Manage contacts, inventory touchpoints, and relationship activity for partners.",
      to: "/admin/crm",
      cta: "Open CRM",
    },
    {
      title: "Travel-agent CRM",
      description:
        "Manage travel-agent companies, attached contacts, and call logs in one place.",
      to: "/admin/travel-agents",
      cta: "Open travel agents",
    },
    {
      title: "QR analytics",
      description:
        "Review scan performance and attribution trends from QR campaigns.",
      to: "/admin/qr",
      cta: "View analytics",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card
        styles={{ body: { padding: 28 } }}
        style={{
          borderRadius: 24,
          background:
            "linear-gradient(135deg, rgba(255, 251, 235, 0.96), rgba(240, 249, 255, 0.96))",
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        }}
      >
        <Row gutter={[16, 16]} justify="space-between" align="middle">
          <Col flex="auto">
            <Space direction="vertical" size={8}>
              <Typography.Text type="secondary">Ahangama Admin</Typography.Text>
              <Typography.Title level={2} style={{ margin: 0 }}>
                Welcome back, {displayName}
              </Typography.Title>
              <Typography.Paragraph
                type="secondary"
                style={{ margin: 0, maxWidth: 720 }}
              >
                Use this as the index for the admin workspace. Jump into the
                main tools, check the latest operational signals, and start the
                next venue or CRM task without digging through a long dashboard.
              </Typography.Paragraph>
            </Space>
          </Col>
        </Row>
      </Card>

      {error ? (
        <Alert
          type="error"
          showIcon
          message="Dashboard data unavailable"
          description={error}
        />
      ) : null}

      {loading ? (
        <Card style={{ borderRadius: 20 }}>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : (
        <>
          <Space size={[12, 12]} wrap>
            <MetricCard
              label="Total venues"
              value={venues.length}
              accent="#0f172a"
            />
            <MetricCard label="Live" value={liveCount} accent="#0f766e" />
            <MetricCard
              label="Coming soon"
              value={comingSoonCount}
              accent="#9a3412"
            />
            <MetricCard
              label="Staff picks"
              value={staffPickCount}
              accent="#7c3aed"
            />
          </Space>

          <Card
            title="Workspace index"
            styles={{ body: { padding: 20 } }}
            style={{
              borderRadius: 20,
              border: "1px solid rgba(15, 23, 42, 0.06)",
              boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
            }}
          >
            <Row gutter={[16, 16]}>
              {workspaceCards.map((card) => (
                <Col key={card.to} xs={24} md={12} xl={8}>
                  <WorkspaceCard {...card} />
                </Col>
              ))}
            </Row>
          </Card>

          <Card
            title="Live category snapshot"
            styles={{ body: { padding: 20 } }}
            style={{
              borderRadius: 20,
              border: "1px solid rgba(15, 23, 42, 0.06)",
              boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
            }}
          >
            {categorySummary.length === 0 ? (
              <Typography.Text type="secondary">
                No live category data yet.
              </Typography.Text>
            ) : (
              <Space size={[8, 8]} wrap>
                {categorySummary.map(([category, count]) => (
                  <Tag key={category} color="gold">
                    {category}: {count}
                  </Tag>
                ))}
              </Space>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
