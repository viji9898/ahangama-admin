import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  Alert,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";

const { RangePicker } = DatePicker;
const GA_PAGE_VIEWS_ENDPOINT = "/.netlify/functions/ga-page-views";
const DEFAULT_RANGE: [Dayjs, Dayjs] = [dayjs().subtract(29, "day"), dayjs()];

type PageViewRow = {
  key: string;
  label: string;
  scope: string;
  path: string;
  pageViews: number;
  users: number;
  sessions: number;
};

type PageViewPayload = {
  ok?: boolean;
  error?: string;
  hostName?: string;
  startDate?: string;
  endDate?: string;
  rows?: PageViewRow[];
};

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function GAAnalytics() {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(DEFAULT_RANGE);
  const [rows, setRows] = useState<PageViewRow[]>([]);
  const [hostName, setHostName] = useState("ahangama.com");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadAnalytics = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          startDate: dateRange[0].format("YYYY-MM-DD"),
          endDate: dateRange[1].format("YYYY-MM-DD"),
        });

        const response = await fetch(
          `${GA_PAGE_VIEWS_ENDPOINT}?${params.toString()}`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );
        const payload = (await response.json().catch(() => ({}))) as PageViewPayload;

        if (!response.ok || payload?.ok === false) {
          throw new Error(
            payload?.error || `Failed to load analytics (${response.status})`,
          );
        }

        setHostName(payload.hostName || "ahangama.com");
        setRows(Array.isArray(payload.rows) ? payload.rows : []);
      } catch (loadError) {
        if ((loadError as Error)?.name === "AbortError") return;
        setError(String((loadError as Error)?.message || loadError));
      } finally {
        setLoading(false);
      }
    };

    void loadAnalytics();

    return () => controller.abort();
  }, [dateRange]);

  const totals = useMemo(() => {
    const site = rows.find((row) => row.key === "site");
    const guide = rows.find((row) => row.key === "guide");
    const events = rows.find((row) => row.key === "events");

    return {
      siteViews: site?.pageViews || 0,
      guideViews: guide?.pageViews || 0,
      eventsViews: events?.pageViews || 0,
      siteUsers: site?.users || 0,
    };
  }, [rows]);

  const columns: ColumnsType<PageViewRow> = [
    {
      title: "Page",
      dataIndex: "label",
      key: "label",
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{value}</Typography.Text>
          <Space size={6} wrap>
            <Tag>{record.scope}</Tag>
            <Typography.Text type="secondary">{record.path}</Typography.Text>
          </Space>
        </Space>
      ),
    },
    {
      title: "Page views",
      dataIndex: "pageViews",
      key: "pageViews",
      align: "right",
      sorter: (left, right) => left.pageViews - right.pageViews,
      render: (value: number) => <Typography.Text strong>{formatInteger(value)}</Typography.Text>,
    },
    {
      title: "Users",
      dataIndex: "users",
      key: "users",
      align: "right",
      sorter: (left, right) => left.users - right.users,
      render: (value: number) => formatInteger(value),
    },
    {
      title: "Sessions",
      dataIndex: "sessions",
      key: "sessions",
      align: "right",
      sorter: (left, right) => left.sessions - right.sessions,
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
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Space
            align="start"
            style={{ width: "100%", justifyContent: "space-between" }}
            wrap
          >
            <Space direction="vertical" size={8}>
              <Typography.Text type="secondary">Google Analytics</Typography.Text>
              <Typography.Title level={2} style={{ margin: 0 }}>
                Analytics
              </Typography.Title>
              <Typography.Paragraph
                type="secondary"
                style={{ margin: 0, maxWidth: 760 }}
              >
                Page views for {hostName}, /guide, and /events.
              </Typography.Paragraph>
            </Space>

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

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic title="ahangama.com Page Views" value={totals.siteViews} formatter={(value) => formatInteger(Number(value))} />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic title="/guide Page Views" value={totals.guideViews} formatter={(value) => formatInteger(Number(value))} />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic title="/events Page Views" value={totals.eventsViews} formatter={(value) => formatInteger(Number(value))} />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic title="ahangama.com Users" value={totals.siteUsers} formatter={(value) => formatInteger(Number(value))} />
            </Card>
          </Col>
        </Row>

        <Card
          title="Page view breakdown"
          style={{ marginTop: 16 }}
          styles={{ body: { padding: 0 } }}
        >
          <Table<PageViewRow>
            rowKey="key"
            columns={columns}
            dataSource={rows}
            pagination={false}
            locale={{ emptyText: <Empty description="No analytics data" /> }}
            scroll={{ x: 720 }}
          />
        </Card>
      </Spin>
    </div>
  );
}
