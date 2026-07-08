import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from "antd";

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
    freePassPromoStats?: {
      totals?: {
        freePassPageViews?: number;
        freePassSessions?: number;
        freePassUsers?: number;
      };
      rows?: Array<{
        key?: string;
        venueLabel?: string;
        utmContent?: string;
        targetPath?: string;
        freePassPageViews?: number;
        freePassSessions?: number;
        freePassUsers?: number;
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

export default function AdminOperations() {
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

  const dailyEmailReportDate = formatReportDate(dailyEmailData?.reportDate);
  const dailyEmailSubject =
    dailyEmailData?.preview?.subject || "Daily team email";
  const dailyEmailRecipients =
    dailyEmailData?.sendResult?.recipientEmails?.length;
  const dailyAiSummary = dailyEmailData?.preview?.aiSummary;
  const dailyVenueReview = dailyEmailData?.preview?.venueReview;
  const dailyPromoStats = dailyEmailData?.preview?.freePassPromoStats;
  const aiChangeCount = dailyAiSummary?.changes?.length ?? 0;
  const aiIssueCount = dailyAiSummary?.issues?.length ?? 0;
  const aiReviewTargetCount = dailyAiSummary?.reviewTargets?.length ?? 0;
  const updatedVenueCount = dailyVenueReview?.updatedVenues?.length ?? 0;
  const incompleteVenueCount = dailyVenueReview?.incompleteVenues?.length ?? 0;
  const promoPageViewCount =
    dailyPromoStats?.totals?.freePassPageViews ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card
        styles={{ body: { padding: 28 } }}
        style={{
          borderRadius: 24,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        }}
      >
        <Space direction="vertical" size={8}>
          <Typography.Text type="secondary">Daily operations</Typography.Text>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Team ops snapshot
          </Typography.Title>
          <Typography.Paragraph
            type="secondary"
            style={{ margin: 0, maxWidth: 760 }}
          >
            Keep the team summary moving, review the current AI output, and send
            the daily operations email from one place.
          </Typography.Paragraph>
        </Space>
      </Card>

      <Card
        styles={{ body: { padding: 20 } }}
        style={{
          borderRadius: 20,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
        }}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            Keep the team summary moving and monitor the current ops snapshot
            for {dailyEmailReportDate}.
          </Typography.Paragraph>

          {dailyEmailLoading ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : (
            <>
              <Space size={[8, 8]} wrap>
                <Tag color={dailyEmailData?.alreadySent ? "gold" : "green"}>
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
                  <Tag color="gold">{aiReviewTargetCount} review targets</Tag>
                ) : null}
                {updatedVenueCount ? (
                  <Tag color="green">{updatedVenueCount} updated venues</Tag>
                ) : null}
                {incompleteVenueCount ? (
                  <Tag color="orange">
                    {incompleteVenueCount} incomplete venues
                  </Tag>
                ) : null}
                <Tag color={promoPageViewCount ? "purple" : undefined}>
                  {promoPageViewCount} promo page views
                </Tag>
              </Space>

              {dailyPromoStats?.rows?.length ? (
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <Typography.Text strong>
                    Free pass promo page views
                  </Typography.Text>
                  {dailyPromoStats.rows.map((row) => (
                    <Typography.Text
                      key={row.key || row.utmContent || row.targetPath}
                      type="secondary"
                    >
                      {row.venueLabel || row.utmContent}: {row.freePassPageViews ?? 0} views
                    </Typography.Text>
                  ))}
                </Space>
              ) : null}

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
    </div>
  );
}
