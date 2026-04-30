import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
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
  Tooltip,
  Typography,
} from "antd";
import QRScanMap from "../components/QRScanMap";

const { RangePicker } = DatePicker;
const DASHBOARD_ENDPOINT = "/.netlify/functions/ga4-qr-dashboard";
const DEFAULT_RANGE = [dayjs().subtract(29, "day"), dayjs()];
const PERFORMANCE_SORT_OPTIONS = [
  { label: "Sessions", value: "sessions" },
  { label: "Users", value: "users" },
  { label: "Events", value: "events" },
  { label: "CTA Clicks", value: "ctaClick" },
  { label: "Purchases", value: "purchases" },
  { label: "Revenue", value: "revenue" },
  { label: "Conversion Rate", value: "conversionRate" },
  { label: "Purchase Rate", value: "purchaseRate" },
];
const CONVERSION_RATE_FILTER_OPTIONS = [
  { label: "All Rates", value: "all" },
  { label: "Below 2%", value: "below-2" },
  { label: "At least 2%", value: "at-least-2" },
  { label: "Below 10%", value: "below-10" },
  { label: "At least 10%", value: "at-least-10" },
];
const SUMMARY_METRICS = [
  { key: "sessions", title: "Total Sessions", color: "#0f172a" },
  { key: "users", title: "Total Users", color: "#0f766e" },
  { key: "events", title: "Total Events", color: "#9a3412" },
  { key: "ctaClick", title: "CTA Clicks", color: "#2563eb" },
  { key: "purchases", title: "Purchases", color: "#7c3aed" },
  { key: "revenue", title: "Revenue", color: "#15803d" },
];
const MAP_SIZE_METRIC_OPTIONS = [
  { label: "Sessions", value: "sessions" },
  { label: "CTA Clicks", value: "ctaClick" },
  { label: "Purchases", value: "purchases" },
];
const MAP_COLOR_METRIC_OPTIONS = [
  { label: "Purchase Rate", value: "purchaseRate" },
  { label: "Conversion Rate", value: "conversionRate" },
];

function formatLabel(value) {
  const normalized = String(value || "unknown").trim();
  if (!normalized) return "Unknown";

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLandingPages(values) {
  if (!values.length) return "-";

  return values
    .map((item) => `${item.landingPage} (${item.sessions})`)
    .join(", ");
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function matchesConversionRateFilter(value, filter) {
  switch (filter) {
    case "below-2":
      return value < 0.02;
    case "at-least-2":
      return value >= 0.02;
    case "below-10":
      return value < 0.1;
    case "at-least-10":
      return value >= 0.1;
    default:
      return true;
  }
}

function getConversionRateTone(value) {
  if (value >= 0.1) {
    return {
      rowClassName: "qr-dashboard-row--high",
      tagColor: "success",
      label: "High",
    };
  }

  if (value < 0.02) {
    return {
      rowClassName: "qr-dashboard-row--low",
      tagColor: "error",
      label: "Low",
    };
  }

  return {
    rowClassName: "qr-dashboard-row--mid",
    tagColor: "warning",
    label: "Mid",
  };
}

export default function QRDashboard() {
  const [dateRange, setDateRange] = useState(DEFAULT_RANGE);
  const [selectedVenue, setSelectedVenue] = useState();
  const [sortMetric, setSortMetric] = useState("sessions");
  const [conversionRateFilter, setConversionRateFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [scanMapRows, setScanMapRows] = useState([]);
  const [rootTrafficRows, setRootTrafficRows] = useState([]);
  const [passTrafficRows, setPassTrafficRows] = useState([]);
  const [stats, setStats] = useState({ ctaClick: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapSizeMetric, setMapSizeMetric] = useState("sessions");
  const [mapColorMetric, setMapColorMetric] = useState("purchaseRate");

  useEffect(() => {
    const controller = new AbortController();

    const fetchDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          startDate: dateRange[0].format("YYYY-MM-DD"),
          endDate: dateRange[1].format("YYYY-MM-DD"),
        });

        const response = await fetch(
          `${DASHBOARD_ENDPOINT}?${params.toString()}`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );
        const payload = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              `Failed to load QR dashboard (${response.status})`,
          );
        }

        setRows(Array.isArray(payload) ? payload : payload?.rows || []);
        setScanMapRows(
          Array.isArray(payload?.scanMapRows) ? payload.scanMapRows : [],
        );
        setRootTrafficRows(
          Array.isArray(payload?.rootTrafficRows)
            ? payload.rootTrafficRows
            : [],
        );
        setPassTrafficRows(
          Array.isArray(payload?.passTrafficRows)
            ? payload.passTrafficRows
            : [],
        );
        setStats({
          ctaClick: Number(payload?.stats?.ctaClick || 0),
        });
      } catch (fetchError) {
        if (fetchError?.name === "AbortError") {
          return;
        }

        setError(String(fetchError?.message || fetchError));
        setRows([]);
        setScanMapRows([]);
        setRootTrafficRows([]);
        setPassTrafficRows([]);
        setStats({ ctaClick: 0 });
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboard();

    return () => controller.abort();
  }, [dateRange, selectedVenue]);

  const venueOptions = useMemo(() => {
    const uniqueVenues = [
      ...new Set(rows.map((row) => row.venue).filter(Boolean)),
    ];

    return uniqueVenues
      .sort((left, right) => left.localeCompare(right))
      .map((venue) => ({
        label: formatLabel(venue),
        value: venue,
      }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!selectedVenue) {
      return rows;
    }

    return rows.filter((row) => row.venue === selectedVenue);
  }, [rows, selectedVenue]);

  const groupedRows = useMemo(() => {
    const grouped = new Map();

    for (const row of filteredRows) {
      const venue =
        String(row.venue || "unknown")
          .trim()
          .toLowerCase() || "unknown";
      const surface =
        String(row.surface || "unknown")
          .trim()
          .toLowerCase() || "unknown";
      const creative = String(row.creative || "unknown").trim() || "unknown";
      const landingPage = String(row.landingPage || "").trim();
      const key = `${venue}::${surface}`;
      const existing = grouped.get(key);
      const rowSessions = Number(row.sessions || 0);

      if (existing) {
        existing.sessions += rowSessions;
        existing.users += Number(row.users || 0);
        existing.events += Number(row.events || 0);
        existing.ctaClick += Number(row.ctaClick || 0);
        existing.purchases += Number(row.purchases || 0);
        existing.revenue += Number(row.revenue || 0);
        existing.creatives.add(creative);
        if (landingPage) {
          existing.landingPages.set(
            landingPage,
            (existing.landingPages.get(landingPage) || 0) + rowSessions,
          );
        }
        continue;
      }

      grouped.set(key, {
        key,
        venue,
        surface,
        sessions: rowSessions,
        users: Number(row.users || 0),
        events: Number(row.events || 0),
        ctaClick: Number(row.ctaClick || 0),
        purchases: Number(row.purchases || 0),
        revenue: Number(row.revenue || 0),
        creatives: new Set([creative]),
        landingPages: landingPage
          ? new Map([[landingPage, rowSessions]])
          : new Map(),
      });
    }

    return [...grouped.values()]
      .map((item) => {
        const creatives = [...item.creatives].sort((left, right) =>
          left.localeCompare(right),
        );
        const landingPages = [...item.landingPages.entries()]
          .map(([landingPage, sessions]) => ({ landingPage, sessions }))
          .sort(
            (left, right) =>
              right.sessions - left.sessions ||
              left.landingPage.localeCompare(right.landingPage),
          );

        return {
          key: item.key,
          venue: item.venue,
          surface: item.surface,
          creative:
            creatives.length > 1
              ? `${creatives[0]} +${creatives.length - 1}`
              : creatives[0] || "unknown",
          creativeCount: creatives.length,
          creativeList: creatives,
          sessions: item.sessions,
          users: item.users,
          events: item.events,
          ctaClick: item.ctaClick,
          purchases: item.purchases,
          revenue: item.revenue,
          conversionRate: item.sessions > 0 ? item.ctaClick / item.sessions : 0,
          purchaseRate: item.sessions > 0 ? item.purchases / item.sessions : 0,
          revenuePerSession:
            item.sessions > 0 ? item.revenue / item.sessions : 0,
          landingPage: formatLandingPages(landingPages),
          landingPages,
        };
      })
      .sort(
        (left, right) => (right[sortMetric] || 0) - (left[sortMetric] || 0),
      );
  }, [filteredRows, sortMetric]);

  const visibleRows = useMemo(() => {
    return groupedRows.filter((row) =>
      matchesConversionRateFilter(row.conversionRate, conversionRateFilter),
    );
  }, [groupedRows, conversionRateFilter]);

  const visibleScanMapRows = useMemo(() => {
    return scanMapRows.filter((row) => {
      if (
        selectedVenue &&
        !Array.isArray(row.sourceVenues) &&
        row.sourceVenues !== selectedVenue
      ) {
        return false;
      }

      if (
        selectedVenue &&
        Array.isArray(row.sourceVenues) &&
        !row.sourceVenues.includes(selectedVenue)
      ) {
        return false;
      }

      return matchesConversionRateFilter(
        Number(row.conversionRate || 0),
        conversionRateFilter,
      );
    });
  }, [conversionRateFilter, scanMapRows, selectedVenue]);

  const totals = useMemo(() => {
    return visibleRows.reduce(
      (accumulator, row) => ({
        totalSessions: accumulator.totalSessions + row.sessions,
        totalUsers: accumulator.totalUsers + row.users,
        totalEvents: accumulator.totalEvents + row.events,
        totalCtaClicks: accumulator.totalCtaClicks + row.ctaClick,
        totalPurchases: accumulator.totalPurchases + row.purchases,
        totalRevenue: accumulator.totalRevenue + row.revenue,
      }),
      {
        totalSessions: 0,
        totalUsers: 0,
        totalEvents: 0,
        totalCtaClicks: 0,
        totalPurchases: 0,
        totalRevenue: 0,
      },
    );
  }, [visibleRows]);

  const columns = useMemo(
    () => [
      {
        title: "Venue",
        dataIndex: "venue",
        key: "venue",
        render: (value) => formatLabel(value),
      },
      {
        title: "Surface",
        dataIndex: "surface",
        key: "surface",
        render: (value) => formatLabel(value),
      },
      {
        title: "Creative",
        dataIndex: "creative",
        key: "creative",
        render: (_, record) => (
          <Space size={[4, 4]} wrap>
            {record.creativeList.map((creative) => (
              <Tag key={creative} color="blue">
                {creative}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: "Sessions",
        dataIndex: "sessions",
        key: "sessions",
        sorter: (left, right) => left.sessions - right.sessions,
        defaultSortOrder: "descend",
      },
      {
        title: "Users",
        dataIndex: "users",
        key: "users",
        sorter: (left, right) => left.users - right.users,
      },
      {
        title: "Events",
        dataIndex: "events",
        key: "events",
        sorter: (left, right) => left.events - right.events,
      },
      {
        title: "CTA Clicks",
        dataIndex: "ctaClick",
        key: "ctaClick",
        sorter: (left, right) => left.ctaClick - right.ctaClick,
      },
      {
        title: "Purchases",
        dataIndex: "purchases",
        key: "purchases",
        sorter: (left, right) => left.purchases - right.purchases,
      },
      {
        title: "Revenue",
        dataIndex: "revenue",
        key: "revenue",
        sorter: (left, right) => left.revenue - right.revenue,
        render: (value) => formatCurrency(value),
      },
      {
        title: (
          <Tooltip title="Calculated as CTA Clicks divided by Sessions.">
            <span>Conversion Rate</span>
          </Tooltip>
        ),
        dataIndex: "conversionRate",
        key: "conversionRate",
        sorter: (left, right) => left.conversionRate - right.conversionRate,
        render: (value, record) => {
          const tone = getConversionRateTone(value);
          const detail = `${record.ctaClick} CTA clicks / ${record.sessions} sessions = ${formatPercent(value)}`;

          return (
            <Tooltip title={detail}>
              <Tag color={tone.tagColor}>{formatPercent(value)}</Tag>
            </Tooltip>
          );
        },
      },
      {
        title: (
          <Tooltip title="Calculated as Purchases divided by Sessions.">
            <span>Purchase Rate</span>
          </Tooltip>
        ),
        dataIndex: "purchaseRate",
        key: "purchaseRate",
        sorter: (left, right) => left.purchaseRate - right.purchaseRate,
        render: (value, record) => {
          const detail = `${record.purchases} purchases / ${record.sessions} sessions = ${formatPercent(value)}`;

          return <Tooltip title={detail}>{formatPercent(value)}</Tooltip>;
        },
      },
      {
        title: "Scan Destination",
        dataIndex: "landingPage",
        key: "landingPage",
        render: (_, record) => (
          <Typography.Text
            title={
              record.landingPages
                .map((item) => `${item.landingPage} (${item.sessions})`)
                .join("\n") || "-"
            }
          >
            {record.landingPage}
          </Typography.Text>
        ),
      },
    ],
    [],
  );

  const hostTrafficColumns = useMemo(
    () => [
      {
        title: "Host",
        dataIndex: "hostName",
        key: "hostName",
      },
      {
        title: "Source",
        dataIndex: "source",
        key: "source",
      },
      {
        title: "Medium",
        dataIndex: "medium",
        key: "medium",
      },
      {
        title: "Sessions",
        dataIndex: "sessions",
        key: "sessions",
        sorter: (left, right) => left.sessions - right.sessions,
        defaultSortOrder: "descend",
      },
      {
        title: "Users",
        dataIndex: "users",
        key: "users",
        sorter: (left, right) => left.users - right.users,
      },
      {
        title: "Page Views",
        dataIndex: "pageViews",
        key: "pageViews",
        sorter: (left, right) => left.pageViews - right.pageViews,
      },
    ],
    [],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <style>
        {`
          .qr-performance-table .ant-table-tbody > tr.qr-dashboard-row--high > td {
            background: rgba(22, 163, 74, 0.08) !important;
          }

          .qr-performance-table .ant-table-tbody > tr.qr-dashboard-row--mid > td {
            background: rgba(245, 158, 11, 0.08) !important;
          }

          .qr-performance-table .ant-table-tbody > tr.qr-dashboard-row--low > td {
            background: rgba(220, 38, 38, 0.08) !important;
          }
        `}
      </style>
      <Card
        styles={{ body: { padding: 24 } }}
        style={{
          borderRadius: 24,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        }}
      >
        <Row gutter={[16, 16]} justify="space-between" align="middle">
          <Col flex="auto">
            <Space direction="vertical" size={4}>
              <Typography.Text type="secondary">
                GA4 QR Analytics
              </Typography.Text>
              <Typography.Title level={2} style={{ margin: 0 }}>
                QR Dashboard
              </Typography.Title>
              <Typography.Paragraph
                type="secondary"
                style={{ margin: 0, maxWidth: 760 }}
              >
                Track offline QR performance across venues, surfaces, and
                creatives. The table is grouped by venue and surface so
                postcard, table, and other offline placements roll up cleanly.
              </Typography.Paragraph>
            </Space>
          </Col>

          <Col>
            <Space wrap size={12}>
              <RangePicker
                allowClear={false}
                value={dateRange}
                onChange={(value) => {
                  if (!value || !value[0] || !value[1]) return;
                  setDateRange(value);
                }}
              />
              <Select
                allowClear
                placeholder="Filter by venue"
                value={selectedVenue}
                onChange={setSelectedVenue}
                options={venueOptions}
                style={{ minWidth: 180 }}
              />
              <Select
                value={sortMetric}
                onChange={setSortMetric}
                options={PERFORMANCE_SORT_OPTIONS}
                style={{ minWidth: 160 }}
              />
              <Select
                value={conversionRateFilter}
                onChange={setConversionRateFilter}
                options={CONVERSION_RATE_FILTER_OPTIONS}
                style={{ minWidth: 170 }}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {error ? (
        <Alert
          type="error"
          showIcon
          message="Unable to load QR analytics"
          description={error}
        />
      ) : null}

      <Row gutter={[16, 16]}>
        {SUMMARY_METRICS.map((metric) => {
          const value =
            metric.key === "sessions"
              ? totals.totalSessions
              : metric.key === "users"
                ? totals.totalUsers
                : metric.key === "events"
                  ? totals.totalEvents
                  : metric.key === "ctaClick"
                    ? totals.totalCtaClicks
                    : metric.key === "purchases"
                      ? totals.totalPurchases
                      : totals.totalRevenue;

          return (
            <Col key={metric.key} xs={24} sm={12} lg={6}>
              <Card
                styles={{ body: { padding: 20 } }}
                style={{
                  borderRadius: 20,
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
                }}
              >
                <Statistic
                  title={metric.title}
                  value={value}
                  loading={loading}
                  precision={metric.key === "revenue" ? 2 : 0}
                  prefix={metric.key === "revenue" ? "$" : undefined}
                  valueStyle={{ color: metric.color, fontWeight: 650 }}
                />
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card
        title="QR Performance"
        styles={{ body: { padding: 0 } }}
        style={{
          borderRadius: 24,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div style={{ padding: "16px 24px 0" }}>
          <Typography.Paragraph
            type="secondary"
            style={{ margin: 0, maxWidth: 880 }}
          >
            This table shows which QR placements are bringing people in and
            which ones are driving action and paid outcomes. Use
            <strong> Sessions</strong> to see traffic volume,
            <strong> CTA Clicks</strong> to see action taken,
            <strong> Purchases</strong> and <strong>Revenue</strong> to see paid
            performance, and <strong>Purchase Rate</strong> to spot the most
            efficient venues and surfaces.
          </Typography.Paragraph>
        </div>
        {loading ? (
          <div style={{ padding: 40, display: "grid", placeItems: "center" }}>
            <Spin size="large" />
          </div>
        ) : visibleRows.length === 0 ? (
          <div style={{ padding: 32 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No QR rows match the selected filters."
            />
          </div>
        ) : (
          <Table
            className="qr-performance-table"
            columns={columns}
            dataSource={visibleRows}
            pagination={{ pageSize: 12, showSizeChanger: false }}
            rowClassName={(record) =>
              getConversionRateTone(record.conversionRate).rowClassName
            }
            scroll={{ x: 960 }}
          />
        )}
      </Card>

      <Card
        title="QR Scan Map"
        extra={
          <Space wrap size={12}>
            <Select
              value={mapSizeMetric}
              onChange={setMapSizeMetric}
              options={MAP_SIZE_METRIC_OPTIONS}
              style={{ minWidth: 150 }}
            />
            <Select
              value={mapColorMetric}
              onChange={setMapColorMetric}
              options={MAP_COLOR_METRIC_OPTIONS}
              style={{ minWidth: 170 }}
            />
          </Space>
        }
        styles={{ body: { padding: 0 } }}
        style={{
          borderRadius: 24,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div style={{ padding: "16px 24px 0" }}>
          <Typography.Paragraph
            type="secondary"
            style={{ margin: 0, maxWidth: 880 }}
          >
            This map plots resolved QR scan volume at venue locations. Circle
            size reflects the selected traffic metric, and circle color reflects
            the selected efficiency metric so you can spot both high-volume and
            high-conversion venues quickly.
          </Typography.Paragraph>
        </div>
        {loading ? (
          <div style={{ padding: 40, display: "grid", placeItems: "center" }}>
            <Spin size="large" />
          </div>
        ) : visibleScanMapRows.length === 0 ? (
          <div style={{ padding: 32 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No resolved venue coordinates match the selected filters."
            />
          </div>
        ) : (
          <div style={{ padding: 24 }}>
            <QRScanMap
              rows={visibleScanMapRows}
              sizeMetric={mapSizeMetric}
              colorMetric={mapColorMetric}
            />
          </div>
        )}
      </Card>

      <Card
        title="ahangama.com Traffic"
        extra={
          <Typography.Text type="secondary">
            Manual QR attribution, aligned with the QR dashboard
          </Typography.Text>
        }
        styles={{ body: { padding: 0 } }}
        style={{
          borderRadius: 24,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div style={{ padding: "16px 24px 0" }}>
          <Typography.Paragraph
            type="secondary"
            style={{ margin: 0, maxWidth: 880 }}
          >
            This shows how much QR-attributed traffic reached{" "}
            <strong>ahangama.com</strong>. Use <strong>Sessions</strong> to
            understand visits,
            <strong> Users</strong> to estimate how many people came through,
            and <strong>Page Views</strong> to see whether visitors explored
            beyond the first page.
          </Typography.Paragraph>
        </div>
        {loading ? (
          <div style={{ padding: 40, display: "grid", placeItems: "center" }}>
            <Spin size="large" />
          </div>
        ) : rootTrafficRows.length === 0 ? (
          <div style={{ padding: 32 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No ahangama.com traffic found for the selected date range."
            />
          </div>
        ) : (
          <Table
            columns={hostTrafficColumns}
            dataSource={rootTrafficRows}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 720 }}
          />
        )}
      </Card>

      <Card
        title="pass.ahangama.com Traffic"
        extra={
          <Typography.Text type="secondary">
            Manual QR attribution, aligned with the QR dashboard
          </Typography.Text>
        }
        styles={{ body: { padding: 0 } }}
        style={{
          borderRadius: 24,
          border: "1px solid rgba(15, 23, 42, 0.06)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div style={{ padding: "16px 24px 0" }}>
          <Typography.Paragraph
            type="secondary"
            style={{ margin: 0, maxWidth: 880 }}
          >
            This shows how much QR-attributed traffic made it through to
            <strong> pass.ahangama.com</strong>. Compare this with the main site
            table above to see whether visitors are moving deeper into the pass
            journey after landing on Ahangama.
          </Typography.Paragraph>
        </div>
        {loading ? (
          <div style={{ padding: 40, display: "grid", placeItems: "center" }}>
            <Spin size="large" />
          </div>
        ) : passTrafficRows.length === 0 ? (
          <div style={{ padding: 32 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No pass.ahangama.com traffic found for the selected date range."
            />
          </div>
        ) : (
          <Table
            columns={hostTrafficColumns}
            dataSource={passTrafficRows}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 720 }}
          />
        )}
      </Card>
    </div>
  );
}
