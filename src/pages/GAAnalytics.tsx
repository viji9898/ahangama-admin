import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  Alert,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Segmented,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import GeoVisitorMap, {
  type GeographyLocation,
} from "../components/GeoVisitorMap";
import "./GAAnalytics.css";

const { RangePicker } = DatePicker;
const GA_PAGE_VIEWS_ENDPOINT = "/.netlify/functions/ga-page-views";
const GA_GEOGRAPHY_ENDPOINT = "/.netlify/functions/ga-geography";
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

type GeographyPayload = {
  ok?: boolean;
  error?: string;
  period?: number;
  hostName?: string;
  totals?: { activeUsers?: number; sessions?: number; countries?: number };
  locations?: GeographyLocation[];
  geocodingConfigured?: boolean;
  geocodingError?: string;
  persistentCacheAvailable?: boolean;
  unresolvedLocationCount?: number;
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
  const [geoPeriod, setGeoPeriod] = useState(30);
  const [geoPayload, setGeoPayload] = useState<GeographyPayload>({});
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoError, setGeoError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const loadGeography = async () => {
      setGeoLoading(true);
      setGeoError("");
      try {
        const response = await fetch(
          `${GA_GEOGRAPHY_ENDPOINT}?period=${geoPeriod}`,
          { credentials: "include", signal: controller.signal },
        );
        const payload = (await response.json().catch(() => ({}))) as GeographyPayload;
        if (!response.ok || payload.ok === false) {
          throw new Error(
            payload.error || `Failed to load visitor locations (${response.status})`,
          );
        }
        setGeoPayload(payload);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setGeoError(String((loadError as Error).message || loadError));
        }
      } finally {
        if (!controller.signal.aborted) setGeoLoading(false);
      }
    };
    void loadGeography();
    return () => controller.abort();
  }, [geoPeriod]);

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
    <div className="ga-overview">
      <Card
        className="ga-overview__header"
        styles={{ body: { padding: 28 } }}
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
                Audience location and page views for {hostName}.
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

      <Card className="ga-overview__map-panel" styles={{ body: { padding: 20 } }}>
        <div className="ga-overview__map-heading">
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Users by location
            </Typography.Title>
            <Typography.Text type="secondary">
              Active users and sessions by city
            </Typography.Text>
          </div>
          <Segmented
            aria-label="Visitor map date range"
            value={geoPeriod}
            options={[
              { label: "7 days", value: 7 },
              { label: "30 days", value: 30 },
              { label: "90 days", value: 90 },
            ]}
            onChange={(value) => setGeoPeriod(Number(value))}
          />
        </div>

        <div className="ga-overview__summary">
          {[
            ["Active users", geoPayload.totals?.activeUsers || 0],
            ["Sessions", geoPayload.totals?.sessions || 0],
            ["Countries", geoPayload.totals?.countries || 0],
            ["Selected period", `${geoPeriod} days`],
          ].map(([label, value]) => (
            <div className="ga-overview__summary-item" key={String(label)}>
              <span>{label}</span>
              <strong>
                {typeof value === "number" ? formatInteger(value) : value}
              </strong>
            </div>
          ))}
        </div>

        {geoError ? (
          <Alert type="error" showIcon message="Unable to load visitor map" description={geoError} />
        ) : geoLoading ? (
          <div className="ga-overview__map-state"><Spin size="large" /></div>
        ) : !geoPayload.locations?.length ? (
          <div className="ga-overview__map-state">
            <Empty
              description={
                geoPayload.geocodingConfigured === false
                  ? "No cached coordinates. Configure GOOGLE_MAPS_API_KEY to resolve GA4 cities."
                  : "No location data was returned for this period."
              }
            />
          </div>
        ) : (
          <GeoVisitorMap
            locations={geoPayload.locations}
            totalActiveUsers={geoPayload.totals?.activeUsers || 0}
          />
        )}
        {!geoLoading && Number(geoPayload.unresolvedLocationCount) > 0 ? (
          <Typography.Text className="ga-overview__note">
            {formatInteger(Number(geoPayload.unresolvedLocationCount))} locations could not be placed on the map.
          </Typography.Text>
        ) : null}
        {!geoLoading && geoPayload.geocodingError ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            message="Some locations could not be resolved"
            description={geoPayload.geocodingError}
          />
        ) : null}
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
