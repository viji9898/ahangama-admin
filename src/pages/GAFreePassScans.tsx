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
const FREE_PASS_SCANS_ENDPOINT = "/.netlify/functions/ga-free-pass-scans";
const DEFAULT_RANGE: [Dayjs, Dayjs] = [dayjs().subtract(29, "day"), dayjs()];

type LandingPageRow = {
  landingPage: string;
  utmTerm: string;
  pageViews: number;
  sessions: number;
  users: number;
};

type FreePassScanRow = {
  key: string;
  venue: string;
  venueLabel: string;
  surface: string;
  creative: string;
  utmContent: string;
  pageViews: number;
  sessions: number;
  users: number;
  freePassPageViews: number;
  freePassSessions: number;
  freePassUsers: number;
  freePassLandingPages: LandingPageRow[];
  landingPages: LandingPageRow[];
};

type FreePassPayload = {
  ok?: boolean;
  error?: string;
  totals?: {
    pageViews?: number;
    sessions?: number;
    users?: number;
    freePassPageViews?: number;
    freePassSessions?: number;
    freePassUsers?: number;
  };
  rows?: FreePassScanRow[];
};

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatLandingPages(values: LandingPageRow[] = []) {
  if (!values.length) return "-";

  return values
    .slice(0, 3)
    .map((item) => `${item.landingPage || "(not set)"} (${formatInteger(item.pageViews)})`)
    .join(", ");
}

export default function GAFreePassScans() {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(DEFAULT_RANGE);
  const [rows, setRows] = useState<FreePassScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadScans = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          startDate: dateRange[0].format("YYYY-MM-DD"),
          endDate: dateRange[1].format("YYYY-MM-DD"),
        });

        const response = await fetch(
          `${FREE_PASS_SCANS_ENDPOINT}?${params.toString()}`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );
        const payload = (await response.json().catch(() => ({}))) as FreePassPayload;

        if (!response.ok || payload?.ok === false) {
          throw new Error(
            payload?.error || `Failed to load free pass scans (${response.status})`,
          );
        }

        setRows(Array.isArray(payload.rows) ? payload.rows : []);
      } catch (loadError) {
        if ((loadError as Error)?.name === "AbortError") return;
        setError(String((loadError as Error)?.message || loadError));
      } finally {
        setLoading(false);
      }
    };

    void loadScans();

    return () => controller.abort();
  }, [dateRange]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (accumulator, row) => ({
          pageViews: accumulator.pageViews + row.pageViews,
          sessions: accumulator.sessions + row.sessions,
          users: accumulator.users + row.users,
          freePassPageViews: accumulator.freePassPageViews + row.freePassPageViews,
          freePassSessions: accumulator.freePassSessions + row.freePassSessions,
        }),
        {
          pageViews: 0,
          sessions: 0,
          users: 0,
          freePassPageViews: 0,
          freePassSessions: 0,
        },
      ),
    [rows],
  );

  const columns: ColumnsType<FreePassScanRow> = [
    {
      title: "Venue",
      dataIndex: "venueLabel",
      key: "venueLabel",
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{value}</Typography.Text>
          <Space size={6} wrap>
            <Tag>{record.surface.toUpperCase()}</Tag>
            <Typography.Text type="secondary">{record.utmContent}</Typography.Text>
          </Space>
        </Space>
      ),
      sorter: (left, right) => left.venueLabel.localeCompare(right.venueLabel),
    },
    {
      title: "Top free-pass pages",
      key: "landingPages",
      render: (_value, record) => (
        <Typography.Text type="secondary">
          {formatLandingPages(record.freePassLandingPages)}
        </Typography.Text>
      ),
    },
    {
      title: "UTM-attributed views",
      dataIndex: "pageViews",
      key: "pageViews",
      align: "right",
      defaultSortOrder: "descend",
      sorter: (left, right) => left.pageViews - right.pageViews,
      render: (value: number) => <Typography.Text strong>{formatInteger(value)}</Typography.Text>,
    },
    {
      title: "Free-pass page views",
      dataIndex: "freePassPageViews",
      key: "freePassPageViews",
      align: "right",
      sorter: (left, right) => left.freePassPageViews - right.freePassPageViews,
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
    {
      title: "Users",
      dataIndex: "users",
      key: "users",
      align: "right",
      sorter: (left, right) => left.users - right.users,
      render: (value: number) => formatInteger(value),
    },
  ];

  const expandedRowRender = (record: FreePassScanRow) => (
    <Table<LandingPageRow>
      rowKey={(row) => `${record.key}:${row.landingPage}:${row.utmTerm}`}
      size="small"
      pagination={false}
      dataSource={record.landingPages}
      columns={[
        {
          title: "Landing page",
          dataIndex: "landingPage",
          key: "landingPage",
          render: (value: string) => value || "(not set)",
        },
        {
          title: "UTM term",
          dataIndex: "utmTerm",
          key: "utmTerm",
          width: 120,
          render: (value: string) => value || "-",
        },
        {
          title: "Views",
          dataIndex: "pageViews",
          key: "pageViews",
          align: "right",
          width: 120,
          render: (value: number) => formatInteger(value),
        },
        {
          title: "Sessions",
          dataIndex: "sessions",
          key: "sessions",
          align: "right",
          width: 120,
          render: (value: number) => formatInteger(value),
        },
        {
          title: "Users",
          dataIndex: "users",
          key: "users",
          align: "right",
          width: 120,
          render: (value: number) => formatInteger(value),
        },
      ]}
    />
  );

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
              All Free Pass Scans
            </Typography.Title>
            <Typography.Paragraph
              type="secondary"
              style={{ margin: 0, maxWidth: 760 }}
            >
              QR traffic where the UTM source is qr, medium is offline, and the UTM content includes the PS free-pass surface. The main views column keeps the full UTM-attributed count, while the free-pass page views column shows direct promo=free_pass landing rows when GA4 has them.
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
      </Card>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic title="UTM-attributed Views" value={totals.pageViews} formatter={(value) => formatInteger(Number(value))} />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic title="Free-pass Page Views" value={totals.freePassPageViews} formatter={(value) => formatInteger(Number(value))} />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic title="Sessions" value={totals.sessions} formatter={(value) => formatInteger(Number(value))} />
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic title="Venues" value={rows.length} formatter={(value) => formatInteger(Number(value))} />
            </Card>
          </Col>
        </Row>

        <Card
          title="Free pass scan breakdown"
          style={{ marginTop: 16 }}
          styles={{ body: { padding: 0 } }}
        >
          <Table<FreePassScanRow>
            rowKey="key"
            columns={columns}
            dataSource={rows}
            expandable={{ expandedRowRender }}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            locale={{ emptyText: <Empty description="No free pass scans" /> }}
            scroll={{ x: 980 }}
          />
        </Card>
      </Spin>
    </div>
  );
}
