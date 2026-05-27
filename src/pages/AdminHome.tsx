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
  message,
} from "antd";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import type { Venue } from "../types/venue";

const LIST_ENDPOINT = "/.netlify/functions/api-venues-list";
const ACTIVITY_ENDPOINT = "/.netlify/functions/api-admin-activity-list";
const DAILY_TEAM_EMAIL_ENDPOINT =
  "/.netlify/functions/api-daily-team-email-preview";

type AdminActivity = {
  id: string;
  action: string;
  actorEmail?: string | null;
  entityType: string;
  entityId: string;
  entityName?: string | null;
  venueId?: string | null;
  contactId?: string | null;
  changedFields?: string[];
  details?: Record<string, unknown>;
  createdAt: string;
};

type DailyTeamEmailResponse = {
  ok?: boolean;
  error?: string;
  reportDate?: string;
  alreadySent?: boolean;
  preview?: {
    subject?: string;
    aiSummary?: {
      summary?: string;
      changes?: string[];
      issues?: string[];
      reviewTargets?: string[];
    };
    aiSummaryError?: string;
    venueReview?: {
      updatedVenues?: Array<{
        id?: string;
        name?: string;
        slug?: string;
        area?: string;
        status?: string;
        live?: boolean;
      }>;
      incompleteVenues?: Array<{
        id?: string;
        name?: string;
        slug?: string;
        missingFields?: string[];
      }>;
    };
  };
  sendResult?: {
    skipped?: boolean;
    reason?: string;
    reportDate?: string;
    recipientEmails?: string[];
  };
};

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

function formatReportDate(value?: string) {
  if (!value) return "yesterday";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
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

function getActivityActionLabel(activity: AdminActivity) {
  const entityLabel =
    {
      venue: "venue",
      contact: "contact",
      touchpoint: "inventory",
      interaction: "interaction",
    }[activity.entityType] || activity.entityType;

  const verb =
    {
      view: "viewed",
      create: "created",
      import: "imported",
      update: "updated",
      delete: "deleted",
    }[activity.action] || activity.action;

  return `${verb} ${entityLabel}`;
}

function getActivityActionColor(action: string) {
  return (
    {
      view: "default",
      create: "green",
      import: "purple",
      update: "blue",
      delete: "red",
    }[action] || "default"
  );
}

function getActivityTarget(activity: AdminActivity) {
  if (activity.entityType === "venue") {
    const venueId = String(activity.venueId || activity.entityId || "");
    return venueId
      ? `/admin/venues?venue=${encodeURIComponent(venueId)}`
      : "/admin/venues";
  }

  if (
    activity.entityType === "contact" ||
    activity.entityType === "touchpoint" ||
    activity.entityType === "interaction"
  ) {
    return "/admin/crm";
  }

  return "/admin";
}

function getActivityDetailTags(activity: AdminActivity) {
  const details = activity.details || {};
  const items = [] as string[];

  if (Array.isArray(activity.changedFields) && activity.changedFields.length) {
    items.push(`Changed: ${activity.changedFields.join(", ")}`);
  }

  if (typeof details.interactionType === "string") {
    items.push(`Type: ${details.interactionType}`);
  }
  if (typeof details.outcomeStatus === "string") {
    items.push(`Outcome: ${details.outcomeStatus}`);
  }
  if (typeof details.role === "string") {
    items.push(`Role: ${details.role}`);
  }
  if (typeof details.quantity === "number") {
    items.push(`Quantity: ${details.quantity}`);
  }
  if (typeof details.importedCount === "number") {
    items.push(`Imported: ${details.importedCount}`);
  }
  if (typeof details.sourceFile === "string") {
    items.push(`Source: ${details.sourceFile}`);
  }

  return items;
}

export default function AdminHome() {
  const { user } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dailyEmailLoading, setDailyEmailLoading] = useState(true);
  const [dailyEmailSending, setDailyEmailSending] = useState(false);
  const [dailyEmailError, setDailyEmailError] = useState("");
  const [dailyEmailData, setDailyEmailData] =
    useState<DailyTeamEmailResponse | null>(null);
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");

  const loadDailyTeamEmail = async ({ send = false } = {}) => {
    const params = new URLSearchParams();
    if (send) params.set("send", "1");
    const query = params.toString();

    const response = await fetch(
      query
        ? `${DAILY_TEAM_EMAIL_ENDPOINT}?${query}`
        : DAILY_TEAM_EMAIL_ENDPOINT,
      {
        credentials: "include",
      },
    );
    const data = (await response
      .json()
      .catch(() => ({}))) as DailyTeamEmailResponse;

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || `Failed (${response.status})`);
    }

    setDailyEmailData(data);
    setDailyEmailError("");
    return data;
  };

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

  useEffect(() => {
    const fetchDailyEmail = async () => {
      setDailyEmailLoading(true);
      setDailyEmailError("");

      try {
        await loadDailyTeamEmail();
      } catch (fetchError) {
        setDailyEmailError(
          String((fetchError as Error)?.message || fetchError),
        );
      } finally {
        setDailyEmailLoading(false);
      }
    };

    void fetchDailyEmail();
  }, []);

  useEffect(() => {
    const fetchActivity = async () => {
      setActivityLoading(true);
      setActivityError("");

      try {
        const response = await fetch(`${ACTIVITY_ENDPOINT}?limit=12`, {
          credentials: "include",
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          activities?: AdminActivity[];
        };

        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || `Failed (${response.status})`);
        }

        setActivities(Array.isArray(data?.activities) ? data.activities : []);
      } catch (fetchError) {
        setActivityError(String((fetchError as Error)?.message || fetchError));
      } finally {
        setActivityLoading(false);
      }
    };

    void fetchActivity();
  }, []);

  const handleRunDailyTeamEmail = async () => {
    setDailyEmailSending(true);
    setDailyEmailError("");

    try {
      const data = await loadDailyTeamEmail({ send: true });
      if (data.sendResult?.skipped) {
        message.warning(
          "Daily team email was already sent for this report date.",
        );
      } else {
        message.success("Daily team email sent.");
      }
    } catch (sendError) {
      const nextError = String((sendError as Error)?.message || sendError);
      setDailyEmailError(nextError);
      message.error(nextError);
    } finally {
      setDailyEmailSending(false);
    }
  };

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
  const dailyEmailReportDate = formatReportDate(dailyEmailData?.reportDate);
  const dailyEmailSubject =
    dailyEmailData?.preview?.subject || "Daily team email";
  const dailyEmailRecipients =
    dailyEmailData?.sendResult?.recipientEmails?.length;
  const dailyAiSummary = dailyEmailData?.preview?.aiSummary;
  const dailyVenueReview = dailyEmailData?.preview?.venueReview;

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
              <Link to="/admin/links">
                <Button>Generate Instagram Link</Button>
              </Link>
              <Link to="/admin/qr-links">
                <Button>Generate QR Link</Button>
              </Link>
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
            <Col xs={24} xl={10}>
              <Card
                title="QR link generator"
                styles={{ body: { padding: 20 } }}
                style={{
                  borderRadius: 20,
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
                }}
              >
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                    Build the canonical UTM destination links used behind QR
                    codes so scans land on the correct page with the right
                    attribution payload.
                  </Typography.Paragraph>
                  <Link to="/admin/qr-links">
                    <Button type="primary">Open QR Link Generator</Button>
                  </Link>
                </Space>
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card
                title="IG Link generator"
                styles={{ body: { padding: 20 } }}
                style={{
                  borderRadius: 20,
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
                }}
              >
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                    Create tracked Instagram links for the pass, guides, or
                    venue posts without rebuilding the path manually.
                  </Typography.Paragraph>
                  <Link to="/admin/links">
                    <Button type="primary">Open Link Generator</Button>
                  </Link>
                </Space>
              </Card>
            </Col>
            <Col xs={24} xl={14}>
              <Card
                title="Recent activity"
                styles={{ body: { padding: 20 } }}
                style={{
                  borderRadius: 20,
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
                }}
              >
                {activityLoading ? (
                  <Skeleton active paragraph={{ rows: 6 }} />
                ) : activityError ? (
                  <Alert
                    type="error"
                    showIcon
                    message="Activity feed unavailable"
                    description={activityError}
                  />
                ) : activities.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No admin activity yet."
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
                    {activities.map((activity) => {
                      const detailTags = getActivityDetailTags(activity);
                      return (
                        <Card
                          key={activity.id}
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
                                {activity.entityName ||
                                  activity.entityId ||
                                  "Untitled activity"}
                              </Typography.Text>
                              <Typography.Text type="secondary">
                                {getActivityActionLabel(activity)}
                              </Typography.Text>
                              <div style={{ marginTop: 8 }}>
                                <Space size={[8, 8]} wrap>
                                  <Tag
                                    color={getActivityActionColor(
                                      activity.action,
                                    )}
                                  >
                                    {activity.action}
                                  </Tag>
                                  <Tag>{activity.entityType}</Tag>
                                  {activity.actorEmail ? (
                                    <Tag>{activity.actorEmail}</Tag>
                                  ) : null}
                                  {detailTags.map((detail) => (
                                    <Tag key={detail}>{detail}</Tag>
                                  ))}
                                </Space>
                              </div>
                            </Col>
                            <Col>
                              <Space direction="vertical" size={8} align="end">
                                <Typography.Text type="secondary">
                                  {formatDateTime(activity.createdAt)}
                                </Typography.Text>
                                <Link to={getActivityTarget(activity)}>
                                  <Button size="small">Open</Button>
                                </Link>
                              </Space>
                            </Col>
                          </Row>
                        </Card>
                      );
                    })}
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
                  title="Daily team email"
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
                    <Typography.Paragraph
                      type="secondary"
                      style={{ margin: 0 }}
                    >
                      Send the daily ops summary for {dailyEmailReportDate}{" "}
                      using the current dashboard email report.
                    </Typography.Paragraph>

                    {dailyEmailLoading ? (
                      <Skeleton active paragraph={{ rows: 2 }} />
                    ) : null}

                    {!dailyEmailLoading ? (
                      <>
                        <Space size={[8, 8]} wrap>
                          <Tag
                            color={
                              dailyEmailData?.alreadySent ? "gold" : "green"
                            }
                          >
                            {dailyEmailData?.alreadySent
                              ? "Already sent"
                              : "Ready to send"}
                          </Tag>
                          <Tag>{dailyEmailReportDate}</Tag>
                          {dailyEmailRecipients ? (
                            <Tag>{dailyEmailRecipients} recipients</Tag>
                          ) : null}
                        </Space>

                        <Typography.Text type="secondary">
                          {dailyEmailSubject}
                        </Typography.Text>

                        {dailyAiSummary?.summary ? (
                          <Card
                            size="small"
                            styles={{ body: { padding: 16 } }}
                            style={{
                              borderRadius: 16,
                              background: "rgba(248,250,252,0.8)",
                            }}
                          >
                            <Space
                              direction="vertical"
                              size={10}
                              style={{ width: "100%" }}
                            >
                              <Typography.Text strong>
                                AI Admin Summary
                              </Typography.Text>
                              <Typography.Paragraph style={{ margin: 0 }}>
                                {dailyAiSummary.summary}
                              </Typography.Paragraph>

                              {dailyAiSummary.changes?.length ? (
                                <div>
                                  <Typography.Text strong>
                                    What changed
                                  </Typography.Text>
                                  <ul
                                    style={{
                                      margin: "8px 0 0",
                                      paddingLeft: 18,
                                    }}
                                  >
                                    {dailyAiSummary.changes.map((item) => (
                                      <li key={item}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}

                              {dailyAiSummary.issues?.length ? (
                                <div>
                                  <Typography.Text strong>
                                    Needs attention
                                  </Typography.Text>
                                  <ul
                                    style={{
                                      margin: "8px 0 0",
                                      paddingLeft: 18,
                                    }}
                                  >
                                    {dailyAiSummary.issues.map((item) => (
                                      <li key={item}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}

                              {dailyAiSummary.reviewTargets?.length ? (
                                <div>
                                  <Typography.Text strong>
                                    Review targets
                                  </Typography.Text>
                                  <Space
                                    size={[8, 8]}
                                    wrap
                                    style={{ display: "flex", marginTop: 8 }}
                                  >
                                    {dailyAiSummary.reviewTargets.map(
                                      (item) => (
                                        <Tag key={item} color="gold">
                                          {item}
                                        </Tag>
                                      ),
                                    )}
                                  </Space>
                                </div>
                              ) : null}
                            </Space>
                          </Card>
                        ) : null}

                        {dailyEmailData?.preview?.aiSummaryError ? (
                          <Alert
                            type="warning"
                            showIcon
                            message="AI summary unavailable"
                            description={dailyEmailData.preview.aiSummaryError}
                          />
                        ) : null}

                        {dailyVenueReview ? (
                          <Card
                            size="small"
                            styles={{ body: { padding: 16 } }}
                            style={{ borderRadius: 16 }}
                          >
                            <Space
                              direction="vertical"
                              size={10}
                              style={{ width: "100%" }}
                            >
                              <Typography.Text strong>
                                Venue review snapshot
                              </Typography.Text>
                              <div>
                                <Typography.Text strong>
                                  Updated venues
                                </Typography.Text>
                                <div style={{ marginTop: 8 }}>
                                  <Space size={[8, 8]} wrap>
                                    {dailyVenueReview.updatedVenues?.length ? (
                                      dailyVenueReview.updatedVenues.map(
                                        (venue) => (
                                          <Tag
                                            key={
                                              venue.id ||
                                              venue.slug ||
                                              venue.name
                                            }
                                          >
                                            {venue.name ||
                                              venue.slug ||
                                              venue.id}
                                          </Tag>
                                        ),
                                      )
                                    ) : (
                                      <Typography.Text type="secondary">
                                        No venue updates captured for this day.
                                      </Typography.Text>
                                    )}
                                  </Space>
                                </div>
                              </div>
                              <div>
                                <Typography.Text strong>
                                  Incomplete venues
                                </Typography.Text>
                                <div style={{ marginTop: 8 }}>
                                  <Space
                                    direction="vertical"
                                    size={8}
                                    style={{ width: "100%" }}
                                  >
                                    {dailyVenueReview.incompleteVenues
                                      ?.length ? (
                                      dailyVenueReview.incompleteVenues.map(
                                        (venue) => (
                                          <Typography.Text
                                            key={
                                              venue.id ||
                                              venue.slug ||
                                              venue.name
                                            }
                                          >
                                            {venue.name ||
                                              venue.slug ||
                                              venue.id}
                                            : {venue.missingFields?.join(", ")}
                                          </Typography.Text>
                                        ),
                                      )
                                    ) : (
                                      <Typography.Text type="secondary">
                                        No incomplete venue flags for this day.
                                      </Typography.Text>
                                    )}
                                  </Space>
                                </div>
                              </div>
                            </Space>
                          </Card>
                        ) : null}

                        {dailyEmailError ? (
                          <Alert
                            type="error"
                            showIcon
                            message="Daily team email unavailable"
                            description={dailyEmailError}
                          />
                        ) : null}

                        <Button
                          type="primary"
                          block
                          onClick={() => void handleRunDailyTeamEmail()}
                          loading={dailyEmailSending}
                        >
                          Send Daily Team Email
                        </Button>
                      </>
                    ) : null}
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
