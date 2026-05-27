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
  message,
} from "antd";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import type { Venue } from "../types/venue";

const LIST_ENDPOINT = "/.netlify/functions/api-venues-list";
const DAILY_TEAM_EMAIL_ENDPOINT =
  "/.netlify/functions/api-daily-team-email-preview";

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
  const [dailyEmailLoading, setDailyEmailLoading] = useState(true);
  const [dailyEmailSending, setDailyEmailSending] = useState(false);
  const [dailyEmailError, setDailyEmailError] = useState("");
  const [dailyEmailData, setDailyEmailData] =
    useState<DailyTeamEmailResponse | null>(null);

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
      title: "QR analytics",
      description:
        "Review scan performance and attribution trends from QR campaigns.",
      to: "/admin/qr",
      cta: "View analytics",
    },
  ];
  const aiChangeCount = dailyAiSummary?.changes?.length ?? 0;
  const aiIssueCount = dailyAiSummary?.issues?.length ?? 0;
  const aiReviewTargetCount = dailyAiSummary?.reviewTargets?.length ?? 0;
  const updatedVenueCount = dailyVenueReview?.updatedVenues?.length ?? 0;
  const incompleteVenueCount = dailyVenueReview?.incompleteVenues?.length ?? 0;

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

          <Col>
            <Space wrap>
              <Link to="/admin/venues">
                <Button>Open Venue Management</Button>
              </Link>
              <Link to="/admin/crm">
                <Button>Open CRM</Button>
              </Link>
              <Link to="/admin/venues?addVenue=1">
                <Button type="primary">Create New Venue</Button>
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

          <Row gutter={[24, 24]} justify="end">
            <Col xs={24} xl={10}>
              <Space direction="vertical" size={24} style={{ width: "100%" }}>
                <Card
                  title="Daily operations"
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
                      Keep the team summary moving and monitor the current ops
                      snapshot for {dailyEmailReportDate}.
                    </Typography.Paragraph>

                    {dailyEmailLoading ? (
                      <Skeleton active paragraph={{ rows: 2 }} />
                    ) : (
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
                          <Typography.Paragraph style={{ margin: 0 }}>
                            {dailyAiSummary.summary}
                          </Typography.Paragraph>
                        ) : null}

                        <Space size={[8, 8]} wrap>
                          {aiChangeCount ? (
                            <Tag color="blue">{aiChangeCount} changes</Tag>
                          ) : null}
                          {aiIssueCount ? (
                            <Tag color="red">{aiIssueCount} issues</Tag>
                          ) : null}
                          {aiReviewTargetCount ? (
                            <Tag color="gold">
                              {aiReviewTargetCount} review targets
                            </Tag>
                          ) : null}
                          {updatedVenueCount ? (
                            <Tag color="green">
                              {updatedVenueCount} updated venues
                            </Tag>
                          ) : null}
                          {incompleteVenueCount ? (
                            <Tag color="orange">
                              {incompleteVenueCount} incomplete venues
                            </Tag>
                          ) : null}
                        </Space>

                        {dailyEmailData?.preview?.aiSummaryError ? (
                          <Alert
                            type="warning"
                            showIcon
                            message="AI summary unavailable"
                            description={dailyEmailData.preview.aiSummaryError}
                          />
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
                    )}
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
