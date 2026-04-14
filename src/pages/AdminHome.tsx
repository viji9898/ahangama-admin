import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
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

function formatDateTime(value: unknown) {
  if (!value) return "—";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

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
    <Card
      styles={{ body: { padding: 20 } }}
      style={{
        borderRadius: 18,
        border: "1px solid rgba(15, 23, 42, 0.06)",
        boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
      }}
    >
      <Typography.Text type="secondary">{label}</Typography.Text>
      <div
        style={{
          marginTop: 8,
          fontSize: 30,
          lineHeight: 1,
          fontWeight: 650,
          color: accent,
        }}
      >
        {value}
      </div>
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

  const recentVenues = useMemo(() => {
    return [...venues]
      .sort((a, b) => {
        const aTime = new Date(
          String(a.updatedAt || a.updated_at || 0),
        ).getTime();
        const bTime = new Date(
          String(b.updatedAt || b.updated_at || 0),
        ).getTime();
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [venues]);

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
                This is the operational home page for the admin dashboard. Start
                from venue management, review the current directory state, or
                create a new venue entry.
              </Typography.Paragraph>
            </Space>
          </Col>

          <Col>
            <Space wrap>
              <Link to="/admin/venues?addVenue=1">
                <Button type="primary">Create New Venue</Button>
              </Link>
              <Link to="/admin/venues">
                <Button>Open Venue Management</Button>
              </Link>
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
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <MetricCard
                label="Total venues"
                value={venues.length}
                accent="#0f172a"
              />
            </Col>
            <Col xs={12} md={6}>
              <MetricCard label="Live" value={liveCount} accent="#0f766e" />
            </Col>
            <Col xs={12} md={6}>
              <MetricCard
                label="Coming soon"
                value={comingSoonCount}
                accent="#9a3412"
              />
            </Col>
            <Col xs={12} md={6}>
              <MetricCard
                label="Staff picks"
                value={staffPickCount}
                accent="#7c3aed"
              />
            </Col>
          </Row>

          <Row gutter={[24, 24]}>
            <Col xs={24} xl={14}>
              <Card
                title="Recent venue activity"
                styles={{ body: { padding: 20 } }}
                style={{
                  borderRadius: 20,
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
                }}
              >
                {recentVenues.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No venues available yet."
                  >
                    <Link to="/admin/venues?addVenue=1">
                      <Button type="primary">Create the first venue</Button>
                    </Link>
                  </Empty>
                ) : (
                  <Space
                    direction="vertical"
                    size={12}
                    style={{ width: "100%" }}
                  >
                    {recentVenues.map((venue) => (
                      <Card
                        key={venue.id || venue.slug || venue.name}
                        size="small"
                        styles={{ body: { padding: 16 } }}
                        style={{
                          borderRadius: 16,
                          background: "rgba(255,255,255,0.72)",
                        }}
                      >
                        <Row
                          justify="space-between"
                          align="middle"
                          gutter={[12, 12]}
                        >
                          <Col flex="auto">
                            <Typography.Text
                              strong
                              style={{ display: "block" }}
                            >
                              {venue.name || "Untitled venue"}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              {venue.slug || venue.id || "No identifier"}
                            </Typography.Text>
                            <div style={{ marginTop: 8 }}>
                              <Space size={[8, 8]} wrap>
                                <Tag
                                  color={
                                    (venue.live ?? true) ? "green" : "default"
                                  }
                                >
                                  {(venue.live ?? true)
                                    ? "Live"
                                    : "Coming soon"}
                                </Tag>
                                {venue.status ? (
                                  <Tag>{venue.status}</Tag>
                                ) : null}
                                {venue.area ? <Tag>{venue.area}</Tag> : null}
                              </Space>
                            </div>
                          </Col>
                          <Col>
                            <Space direction="vertical" size={8} align="end">
                              <Typography.Text type="secondary">
                                Updated{" "}
                                {formatDateTime(
                                  venue.updatedAt || venue.updated_at,
                                )}
                              </Typography.Text>
                              <Link
                                to={`/admin/venues?venue=${encodeURIComponent(String(venue.id || ""))}`}
                              >
                                <Button size="small">Open</Button>
                              </Link>
                            </Space>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </Space>
                )}
              </Card>
            </Col>

            <Col xs={24} xl={10}>
              <Space direction="vertical" size={24} style={{ width: "100%" }}>
                <Card
                  title="Quick actions"
                  styles={{ body: { padding: 20 } }}
                  style={{
                    borderRadius: 20,
                    border: "1px solid rgba(15, 23, 42, 0.06)",
                    boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
                  }}
                >
                  <Space
                    direction="vertical"
                    size={12}
                    style={{ width: "100%" }}
                  >
                    <Link to="/admin/venues">
                      <Button block>Open venue management</Button>
                    </Link>
                    <Link to="/admin/venues?addVenue=1">
                      <Button type="primary" block>
                        Create new venue
                      </Button>
                    </Link>
                  </Space>
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
              </Space>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
