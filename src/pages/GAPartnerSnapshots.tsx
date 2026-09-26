import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { CopyOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, Select, Space, Spin, Table, Tag, Tooltip, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";

const ENDPOINT = "/.netlify/functions/api-partner-snapshots-list";
const PUBLIC_STATS_BASE_URL = "https://admin.ahangama.com/stats";

type SourceMetrics = { available: boolean };
type Snapshot = {
  key: string;
  venueId: string;
  partnerSlug: string;
  partnerName: string;
  snapshotDate: string;
  periodDays: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  guide: SourceMetrics & {
    impressions: number;
    usersExposed: number;
    engagements: number;
  };
  articles: SourceMetrics & {
    count: number;
    pageViews: number;
    visitors: number;
    engagedReads: number;
    placeClicks: number;
  };
  social: SourceMetrics & {
    views: number;
    reach: number;
    interactions: number;
    posts: number;
  };
};

type Payload = { ok?: boolean; error?: string; snapshots?: Snapshot[] };

const integer = (value: number) =>
  new Intl.NumberFormat("en-US").format(Number(value || 0));

const sourceValue = (available: boolean, value: number) =>
  available ? integer(value) : <Tag color="default">Unavailable</Tag>;

export default function GAPartnerSnapshots() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [partner, setPartner] = useState("all");
  const [period, setPeriod] = useState<number | "all">(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(ENDPOINT, {
          credentials: "include",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as Payload;
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || `Unable to load snapshots (${response.status})`);
        }
        setSnapshots(Array.isArray(payload.snapshots) ? payload.snapshots : []);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError(String((loadError as Error).message || loadError));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const partners = useMemo(
    () =>
      [...new Map(snapshots.map((snapshot) => [snapshot.partnerSlug, snapshot.partnerName])).entries()]
        .sort((left, right) => left[1].localeCompare(right[1]))
        .map(([value, label]) => ({ value, label })),
    [snapshots],
  );
  const filteredSnapshots = snapshots.filter(
    (snapshot) =>
      (partner === "all" || snapshot.partnerSlug === partner) &&
      (period === "all" || snapshot.periodDays === period),
  );

  const copyPublicUrl = async (snapshot: Snapshot) => {
    const publicUrl = `${PUBLIC_STATS_BASE_URL}/${encodeURIComponent(snapshot.partnerSlug)}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      message.success(`Copied ${snapshot.partnerName} public URL`);
    } catch {
      message.error("Unable to copy the public URL");
    }
  };

  const columns: ColumnsType<Snapshot> = [
    {
      title: "Snapshot",
      fixed: "left",
      children: [
        {
          title: "Partner",
          dataIndex: "partnerName",
          key: "partnerName",
          width: 190,
          render: (value: string, record) => (
            <Tooltip title="Copy public stats URL">
              <Button
                type="text"
                icon={<CopyOutlined />}
                onClick={() => void copyPublicUrl(record)}
                style={{ height: "auto", padding: 0, textAlign: "left" }}
              >
                <Space orientation="vertical" size={0}>
                  <Typography.Text strong>{value}</Typography.Text>
                  <Typography.Text type="secondary">
                    {record.venueId} · {record.partnerSlug}
                  </Typography.Text>
                </Space>
              </Button>
            </Tooltip>
          ),
        },
        {
          title: "Date",
          dataIndex: "snapshotDate",
          key: "snapshotDate",
          width: 120,
          render: (value: string) => dayjs(value).format("D MMM YYYY"),
        },
        {
          title: "Period",
          dataIndex: "periodDays",
          key: "periodDays",
          width: 90,
          align: "right",
          render: (value: number) => `${value} days`,
        },
      ],
    },
    {
      title: "Online Guide",
      children: [
        { title: "Impressions", key: "guideImpressions", width: 115, align: "right", render: (_, row) => sourceValue(row.guide.available, row.guide.impressions) },
        { title: "Users exposed", key: "guideUsers", width: 120, align: "right", render: (_, row) => sourceValue(row.guide.available, row.guide.usersExposed) },
        { title: "Actions", key: "guideActions", width: 95, align: "right", render: (_, row) => sourceValue(row.guide.available, row.guide.engagements) },
      ],
    },
    {
      title: "Articles",
      children: [
        { title: "Articles", key: "articleCount", width: 90, align: "right", render: (_, row) => sourceValue(row.articles.available, row.articles.count) },
        { title: "Views", key: "articleViews", width: 90, align: "right", render: (_, row) => sourceValue(row.articles.available, row.articles.pageViews) },
        { title: "Visitors", key: "articleVisitors", width: 95, align: "right", render: (_, row) => sourceValue(row.articles.available, row.articles.visitors) },
        { title: "Engaged reads", key: "engagedReads", width: 120, align: "right", render: (_, row) => sourceValue(row.articles.available, row.articles.engagedReads) },
        { title: "Place clicks", key: "placeClicks", width: 105, align: "right", render: (_, row) => sourceValue(row.articles.available, row.articles.placeClicks) },
      ],
    },
    {
      title: "Instagram",
      children: [
        { title: "Posts", key: "socialPosts", width: 80, align: "right", render: (_, row) => sourceValue(row.social.available, row.social.posts) },
        { title: "Views", key: "socialViews", width: 90, align: "right", render: (_, row) => sourceValue(row.social.available, row.social.views) },
        { title: "Reach", key: "socialReach", width: 90, align: "right", render: (_, row) => sourceValue(row.social.available, row.social.reach) },
        { title: "Interactions", key: "socialInteractions", width: 105, align: "right", render: (_, row) => sourceValue(row.social.available, row.social.interactions) },
      ],
    },
    {
      title: "Timestamps",
      children: [
        { title: "Generated", dataIndex: "generatedAt", key: "generatedAt", width: 170, render: (value: string) => dayjs(value).format("D MMM YYYY, HH:mm") },
        { title: "Created", dataIndex: "createdAt", key: "createdAt", width: 170, render: (value: string) => dayjs(value).format("D MMM YYYY, HH:mm") },
        { title: "Updated", dataIndex: "updatedAt", key: "updatedAt", width: 170, render: (value: string) => dayjs(value).format("D MMM YYYY, HH:mm") },
      ],
    },
  ];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card styles={{ body: { padding: 28 } }}>
        <Space direction="vertical" size={8}>
          <Typography.Text type="secondary">Analytics</Typography.Text>
          <Typography.Title level={2} style={{ margin: 0 }}>Partner snapshots</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            Overview of every stored partner performance snapshot in Neon.
          </Typography.Paragraph>
        </Space>
      </Card>

      {error ? <Alert type="error" showIcon message="Unable to load partner snapshots" description={error} /> : null}

      <Card
        title={`${integer(filteredSnapshots.length)} snapshots`}
        extra={(
          <Space wrap>
            <Select
              aria-label="Filter by partner"
              value={partner}
              style={{ width: 200 }}
              options={[{ value: "all", label: "All partners" }, ...partners]}
              onChange={setPartner}
            />
            <Select
              aria-label="Filter by reporting period"
              value={period}
              style={{ width: 150 }}
              options={[
                { value: "all", label: "All periods" },
                ...[7, 30, 90, 180, 365].map((value) => ({ value, label: `${value} days` })),
              ]}
              onChange={setPeriod}
            />
          </Space>
        )}
        styles={{ body: { padding: 0 } }}
      >
        <Spin spinning={loading}>
          <Table<Snapshot>
            rowKey="key"
            columns={columns}
            dataSource={filteredSnapshots}
            pagination={{ pageSize: 25, showSizeChanger: true }}
            locale={{ emptyText: <Empty description="No partner snapshots found" /> }}
            scroll={{ x: 2200 }}
          />
        </Spin>
      </Card>
    </div>
  );
}