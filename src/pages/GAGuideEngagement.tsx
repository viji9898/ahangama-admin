import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  Alert,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";

const { RangePicker } = DatePicker;
const GUIDE_ENGAGEMENT_ENDPOINT =
  "/.netlify/functions/ga-guide-engagement";
const DEFAULT_RANGE: [Dayjs, Dayjs] = [dayjs().subtract(29, "day"), dayjs()];

type GuideEngagementRow = {
  key: string;
  eventName: string;
  venueId: string;
  venueSlug: string;
  venueName: string;
  guideSection: string;
  linkType: string;
  componentLocation: string;
  targetSection: string;
  selectedFilter: string;
  mapCategory: string;
  eventCount: number;
  users: number;
};

type GuideEngagementPayload = {
  ok?: boolean;
  error?: string;
  totals?: {
    eventCount?: number;
    users?: number;
  };
  missingDimensions?: string[];
  rows?: GuideEngagementRow[];
};

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatLabel(value: string) {
  return value
    .replace(/^guide_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function GAGuideEngagement() {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(DEFAULT_RANGE);
  const [eventFilter, setEventFilter] = useState("all");
  const [rows, setRows] = useState<GuideEngagementRow[]>([]);
  const [gaTotals, setGaTotals] = useState({ eventCount: 0, users: 0 });
  const [missingDimensions, setMissingDimensions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadEngagement = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          startDate: dateRange[0].format("YYYY-MM-DD"),
          endDate: dateRange[1].format("YYYY-MM-DD"),
        });
        const response = await fetch(
          `${GUIDE_ENGAGEMENT_ENDPOINT}?${params.toString()}`,
          { credentials: "include", signal: controller.signal },
        );
        const payload = (await response
          .json()
          .catch(() => ({}))) as GuideEngagementPayload;

        if (!response.ok || payload.ok === false) {
          throw new Error(
            payload.error ||
              `Failed to load guide engagement (${response.status})`,
          );
        }

        setRows(Array.isArray(payload.rows) ? payload.rows : []);
        setGaTotals({
          eventCount: Number(payload.totals?.eventCount || 0),
          users: Number(payload.totals?.users || 0),
        });
        setMissingDimensions(
          Array.isArray(payload.missingDimensions)
            ? payload.missingDimensions
            : [],
        );
      } catch (loadError) {
        if ((loadError as Error)?.name === "AbortError") return;
        setError(String((loadError as Error)?.message || loadError));
      } finally {
        setLoading(false);
      }
    };

    void loadEngagement();
    return () => controller.abort();
  }, [dateRange]);

  const eventOptions = useMemo(
    () => [
      { label: "All guide events", value: "all" },
      ...Array.from(new Set(rows.map((row) => row.eventName)))
        .filter(Boolean)
        .sort()
        .map((value) => ({ label: formatLabel(value), value })),
    ],
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      eventFilter === "all"
        ? rows
        : rows.filter((row) => row.eventName === eventFilter),
    [eventFilter, rows],
  );

  const filteredEventCount = useMemo(
    () =>
      eventFilter === "all"
        ? gaTotals.eventCount
        : filteredRows.reduce((total, row) => total + row.eventCount, 0),
    [eventFilter, filteredRows, gaTotals.eventCount],
  );

  const venueCount = useMemo(
    () =>
      new Set(
        filteredRows
          .map((row) => row.venueId || row.venueSlug || row.venueName)
          .filter(Boolean),
      ).size,
    [filteredRows],
  );

  const columns: ColumnsType<GuideEngagementRow> = [
    {
      title: "Event",
      dataIndex: "eventName",
      key: "eventName",
      render: (value: string) => <Tag color="blue">{formatLabel(value)}</Tag>,
      sorter: (left, right) => left.eventName.localeCompare(right.eventName),
    },
    {
      title: "Venue",
      dataIndex: "venueName",
      key: "venueName",
      render: (value: string, record) => {
        const venueKey = record.venueId || record.venueSlug;

        return value || venueKey ? (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{value || venueKey}</Typography.Text>
            {value && venueKey ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {venueKey}
              </Typography.Text>
            ) : null}
          </Space>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        );
      },
      sorter: (left, right) =>
        (left.venueName || left.venueId || left.venueSlug).localeCompare(
          right.venueName || right.venueId || right.venueSlug,
        ),
    },
    {
      title: "Guide section",
      dataIndex: "guideSection",
      key: "guideSection",
      render: (value: string) => (value ? formatLabel(value) : "-"),
      sorter: (left, right) =>
        left.guideSection.localeCompare(right.guideSection),
    },
    {
      title: "Placement and context",
      key: "context",
      render: (_, record) => {
        const context = [
          record.componentLocation,
          record.linkType,
          record.targetSection,
          record.selectedFilter,
          record.mapCategory,
        ].filter(Boolean);

        return context.length ? (
          <Space size={[4, 4]} wrap>
            {context.map((value) => (
              <Tag key={value}>{formatLabel(value)}</Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        );
      },
    },
    {
      title: "Engagements",
      dataIndex: "eventCount",
      key: "eventCount",
      align: "right",
      defaultSortOrder: "descend",
      sorter: (left, right) => left.eventCount - right.eventCount,
      render: (value: number) => (
        <Typography.Text strong>{formatInteger(value)}</Typography.Text>
      ),
    },
    {
      title: "Users",
      dataIndex: "users",
      key: "users",
      align: "right",
      sorter: (left, right) => left.users - right.users,
      render: (value: number) => formatInteger(value),
    },
  ];

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
        <Space
          align="start"
          style={{ width: "100%", justifyContent: "space-between" }}
          wrap
        >
          <Space direction="vertical" size={8}>
            <Typography.Text type="secondary">Google Analytics</Typography.Text>
            <Typography.Title level={2} style={{ margin: 0 }}>
              Guide Engagement
            </Typography.Title>
            <Typography.Paragraph
              type="secondary"
              style={{ margin: 0, maxWidth: 760 }}
            >
              Engagement with venues, guide navigation, map controls, outbound
              links, and the complimentary pass CTA.
            </Typography.Paragraph>
          </Space>

          <Space wrap>
            <Select
              value={eventFilter}
              options={eventOptions}
              onChange={setEventFilter}
              style={{ minWidth: 210 }}
            />
            <RangePicker
              value={dateRange}
              allowClear={false}
              onChange={(value) => {
                if (!value?.[0] || !value?.[1]) return;
                setDateRange([value[0], value[1]]);
              }}
            />
          </Space>
        </Space>
      </Card>

      {error ? <Alert type="error" showIcon message={error} /> : null}
      {missingDimensions.length ? (
        <Alert
          type="warning"
          showIcon
          message="Some GA4 custom dimensions are not registered"
          description={`Available data is shown. Missing: ${missingDimensions
            .map((name) => name.replace("customEvent:", ""))
            .join(", ")}.`}
        />
      ) : null}

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic
                title="Engagements"
                value={filteredEventCount}
                formatter={(value) => formatInteger(Number(value))}
              />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic
                title="Users (all guide events)"
                value={gaTotals.users}
                formatter={(value) => formatInteger(Number(value))}
              />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic title="Engaged venues" value={venueCount} />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic title="Table records" value={filteredRows.length} />
            </Card>
          </Col>
        </Row>

        <Card
          title="Guide engagement records"
          style={{ marginTop: 16 }}
          styles={{ body: { padding: 0 } }}
        >
          <Table<GuideEngagementRow>
            rowKey="key"
            columns={columns}
            dataSource={filteredRows}
            pagination={{ pageSize: 25, showSizeChanger: true }}
            locale={{ emptyText: <Empty description="No guide engagement" /> }}
            scroll={{ x: 1050 }}
          />
        </Card>
      </Spin>
    </div>
  );
}