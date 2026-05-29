import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  List,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type {
  InteractionType,
  InteractionOutcome,
  PartnerInteraction,
  TravelAgentInteraction,
} from "../types/crm";

const PARTNER_INTERACTIONS_ENDPOINT =
  "/.netlify/functions/api-partner-interactions-list";
const TRAVEL_AGENT_INTERACTIONS_ENDPOINT =
  "/.netlify/functions/api-travel-agent-interactions-list";

type CallLogSource = "partner" | "travel_agent";

type UnifiedCallLog = {
  id: string;
  source: CallLogSource;
  sourceLabel: string;
  interactionType: InteractionType;
  contactName: string;
  accountName: string;
  outcomeStatus: InteractionOutcome;
  summary: string;
  feedback?: string | null;
  nextAction?: string | null;
  nextFollowUpAt?: string | null;
  interactionAt: string;
  createdBy?: string | null;
};

type SourceFilter = "all" | CallLogSource;
type OutcomeFilter = "all" | InteractionOutcome;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  } & T;

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }

  return payload;
}

function mapPartnerInteraction(item: PartnerInteraction): UnifiedCallLog {
  return {
    id: item.id,
    source: "partner",
    sourceLabel: "Partner CRM",
    interactionType: item.interactionType,
    contactName: item.contactName || "Unknown contact",
    accountName: item.venueName || item.venueId,
    outcomeStatus: item.outcomeStatus,
    summary: item.summary,
    feedback: item.feedback,
    nextAction: item.nextAction,
    nextFollowUpAt: item.nextFollowUpAt,
    interactionAt: item.interactionAt,
    createdBy: item.createdBy,
  };
}

function mapTravelAgentInteraction(
  item: TravelAgentInteraction,
): UnifiedCallLog {
  return {
    id: item.id,
    source: "travel_agent",
    sourceLabel: "Travel Agents",
    interactionType: item.interactionType,
    contactName: item.contactName || "Unknown contact",
    accountName: item.companyName || item.companyId,
    outcomeStatus: item.outcomeStatus,
    summary: item.summary,
    feedback: item.feedback,
    nextAction: item.nextAction,
    nextFollowUpAt: item.nextFollowUpAt,
    interactionAt: item.interactionAt,
    createdBy: item.createdBy,
  };
}

function getInteractionTypeColor(value: InteractionType) {
  return (
    {
      call: "blue",
      whatsapp: "green",
      email: "geekblue",
      visit: "purple",
      feedback: "default",
    }[value] || "default"
  );
}

function getInteractionTypeLabel(value: InteractionType) {
  return (
    {
      call: "Call",
      whatsapp: "WhatsApp",
      email: "Email",
      visit: "Visit",
      feedback: "Feedback",
    }[value] || value
  );
}

function getOutcomeColor(value: InteractionOutcome) {
  return (
    {
      pending: "gold",
      successful: "green",
      no_response: "orange",
      not_interested: "red",
    }[value] || "default"
  );
}

function getOutcomeLabel(value: InteractionOutcome) {
  return (
    {
      pending: "Pending",
      successful: "Successful",
      no_response: "No Response",
      not_interested: "Not Interested",
    }[value] || value
  );
}

export default function CallLogs() {
  const { RangePicker } = DatePicker;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const [calls, setCalls] = useState<UnifiedCallLog[]>([]);

  useEffect(() => {
    const loadCalls = async () => {
      setLoading(true);
      setError("");

      try {
        const [partnerResult, travelAgentResult] = await Promise.all([
          fetchJson<{ interactions: PartnerInteraction[] }>(
            PARTNER_INTERACTIONS_ENDPOINT,
          ),
          fetchJson<{ interactions: TravelAgentInteraction[] }>(
            TRAVEL_AGENT_INTERACTIONS_ENDPOINT,
          ),
        ]);

        const partnerCalls = (partnerResult.interactions || []).map(
          mapPartnerInteraction,
        );
        const travelAgentCalls = (travelAgentResult.interactions || []).map(
          mapTravelAgentInteraction,
        );

        const merged = [...partnerCalls, ...travelAgentCalls].sort(
          (left, right) =>
            dayjs(right.interactionAt).valueOf() -
            dayjs(left.interactionAt).valueOf(),
        );

        setCalls(merged);
      } catch (loadError) {
        setError(String((loadError as Error)?.message || loadError));
      } finally {
        setLoading(false);
      }
    };

    void loadCalls();
  }, []);

  const filteredCalls = useMemo(() => {
    const query = search.trim().toLowerCase();

    return calls.filter((call) => {
      if (sourceFilter !== "all" && call.source !== sourceFilter) {
        return false;
      }

      if (outcomeFilter !== "all" && call.outcomeStatus !== outcomeFilter) {
        return false;
      }

      if (dateRange?.[0] || dateRange?.[1]) {
        const interactionAt = dayjs(call.interactionAt);
        if (dateRange[0] && interactionAt.isBefore(dateRange[0], "day")) {
          return false;
        }
        if (dateRange[1] && interactionAt.isAfter(dateRange[1], "day")) {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      const haystack = [
        call.contactName,
        call.accountName,
        call.summary,
        call.feedback,
        call.nextAction,
        call.createdBy,
        call.sourceLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [calls, dateRange, outcomeFilter, search, sourceFilter]);

  const summary = useMemo(() => {
    const successful = filteredCalls.filter(
      (call) => call.outcomeStatus === "successful",
    ).length;
    const pending = filteredCalls.filter(
      (call) => call.outcomeStatus === "pending",
    ).length;
    const noResponse = filteredCalls.filter(
      (call) => call.outcomeStatus === "no_response",
    ).length;

    return {
      total: filteredCalls.length,
      successful,
      pending,
      noResponse,
    };
  }, [filteredCalls]);

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
          <Typography.Text type="secondary">CRM calls</Typography.Text>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Call Logs
          </Typography.Title>
          <Typography.Paragraph
            type="secondary"
            style={{ margin: 0, maxWidth: 760 }}
          >
            Review call, WhatsApp, email, visit, and feedback history across
            both Partner CRM and Travel Agents in one timeline. Search by
            company, venue, contact, or note, and narrow the feed by source when
            needed.
          </Typography.Paragraph>
        </Space>
      </Card>

      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(4, minmax(140px, 1fr))",
            minWidth: 620,
          }}
        >
          <Card
            size="small"
            styles={{ body: { padding: 14 } }}
            style={{ borderRadius: 16 }}
          >
            <Statistic
              title="Showing"
              value={summary.total}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
          <Card
            size="small"
            styles={{ body: { padding: 14 } }}
            style={{ borderRadius: 16 }}
          >
            <Statistic
              title="Successful"
              value={summary.successful}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
          <Card
            size="small"
            styles={{ body: { padding: 14 } }}
            style={{ borderRadius: 16 }}
          >
            <Statistic
              title="Pending"
              value={summary.pending}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
          <Card
            size="small"
            styles={{ body: { padding: 14 } }}
            style={{ borderRadius: 16 }}
          >
            <Statistic
              title="No response"
              value={summary.noResponse}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
        </div>
      </div>

      <Card
        styles={{ body: { padding: 20 } }}
        style={{
          borderRadius: 20,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
        }}
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Input.Search
            allowClear
            size="large"
            placeholder="Search by contact, company, venue, summary, or notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <Segmented
            block
            value={sourceFilter}
            onChange={(value) => setSourceFilter(value as SourceFilter)}
            options={[
              { label: "All calls", value: "all" },
              { label: "Partner CRM", value: "partner" },
              { label: "Travel Agents", value: "travel_agent" },
            ]}
          />

          <Row gutter={[12, 12]}>
            <Row style={{ width: "100%" }} gutter={[12, 12]}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <Select
                  allowClear
                  size="large"
                  placeholder="Filter by outcome"
                  value={outcomeFilter === "all" ? undefined : outcomeFilter}
                  onChange={(value) =>
                    setOutcomeFilter((value as InteractionOutcome) || "all")
                  }
                  options={[
                    { label: "Pending", value: "pending" },
                    { label: "Successful", value: "successful" },
                    { label: "No Response", value: "no_response" },
                    { label: "Not Interested", value: "not_interested" },
                  ]}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 260 }}>
                <RangePicker
                  allowEmpty={[true, true]}
                  size="large"
                  value={dateRange}
                  onChange={(value) =>
                    setDateRange(value ? [value[0], value[1]] : null)
                  }
                  style={{ width: "100%" }}
                />
              </div>
            </Row>
          </Row>
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
        {loading ? (
          <Typography.Text type="secondary">Loading call logs…</Typography.Text>
        ) : error ? (
          <Alert
            type="error"
            showIcon
            message="Call logs unavailable"
            description={error}
          />
        ) : filteredCalls.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No call logs match the current filters."
          >
            <Button
              onClick={() => {
                setSearch("");
                setSourceFilter("all");
                setOutcomeFilter("all");
                setDateRange(null);
              }}
            >
              Clear filters
            </Button>
          </Empty>
        ) : (
          <List
            dataSource={filteredCalls}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Tag
                        color={item.source === "partner" ? "blue" : "purple"}
                      >
                        {item.sourceLabel}
                      </Tag>
                      <Tag
                        color={getInteractionTypeColor(item.interactionType)}
                      >
                        {getInteractionTypeLabel(item.interactionType)}
                      </Tag>
                      <Tag color={getOutcomeColor(item.outcomeStatus)}>
                        {getOutcomeLabel(item.outcomeStatus)}
                      </Tag>
                      <Typography.Text strong>
                        {item.contactName}
                      </Typography.Text>
                      <Typography.Text>{item.summary}</Typography.Text>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Space wrap size={8}>
                        <Typography.Text type="secondary">
                          {item.accountName}
                        </Typography.Text>
                        <Typography.Text type="secondary">·</Typography.Text>
                        <Typography.Text type="secondary">
                          {dayjs(item.interactionAt).format("YYYY-MM-DD HH:mm")}
                        </Typography.Text>
                        {item.createdBy ? (
                          <>
                            <Typography.Text type="secondary">
                              ·
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              Logged by: {item.createdBy}
                            </Typography.Text>
                          </>
                        ) : null}
                      </Space>
                      <Typography.Text type="secondary">
                        Contact: {item.contactName}
                      </Typography.Text>
                      {item.nextAction ? (
                        <Typography.Text type="secondary">
                          Next: {item.nextAction}
                        </Typography.Text>
                      ) : null}
                      {item.nextFollowUpAt ? (
                        <Typography.Text type="secondary">
                          Follow-up:{" "}
                          {dayjs(item.nextFollowUpAt).format(
                            "YYYY-MM-DD HH:mm",
                          )}
                        </Typography.Text>
                      ) : null}
                      {item.feedback ? (
                        <Typography.Text type="secondary">
                          {item.feedback}
                        </Typography.Text>
                      ) : null}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}
