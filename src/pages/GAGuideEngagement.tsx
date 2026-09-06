import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  Alert, Card, Col, Collapse, DatePicker, Empty, Row, Select, Space,
  Spin, Statistic, Table, Tag, Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import "./GAGuideEngagement.css";

const { RangePicker } = DatePicker;
const ENDPOINT = "/.netlify/functions/ga-guide-engagement";
const DEFAULT_RANGE: [Dayjs, Dayjs] = [dayjs().subtract(29, "day"), dayjs()];

type LegacyRow = {
  key: string; eventName: string; venueId: string; venueSlug: string;
  venueName: string; guideSection: string; linkType: string;
  componentLocation: string; targetSection: string; selectedFilter: string;
  mapCategory: string; eventCount: number; users: number;
};
type VenueRow = {
  key: string; venueId: string; venueSlug: string; venueName: string;
  impressions: number; usersExposed: number; engagements: number;
  usersEngaged?: number; lightboxOpens: number; otherInteractions: number;
  instagram: number; directions: number; website: number;
  unclassified: number; totalActions: number;
};
type BreakdownRow = {
  key: string; label: string; impressions: number; users: number; actions: number;
};
type TimeRow = {
  key: string; date: string; venueId: string; venueSlug: string;
  venueName: string; impressions: number; actions: number;
};
type QualityRow = { metric: string; count: number; total: number };
type DimensionStatus = { apiName: string; registered: boolean };
type Payload = {
  ok?: boolean; error?: string;
  source?: { label?: string };
  minimumActionRateImpressions?: number;
  totals?: { eventCount?: number; users?: number };
  venuePerformance?: {
    totals?: { impressions?: number; usersExposed?: number; engagements?: number; outboundActions?: number };
    venues?: VenueRow[]; sections?: BreakdownRow[]; components?: BreakdownRow[];
    positions?: BreakdownRow[] | null; timeSeries?: TimeRow[]; qa?: QualityRow[];
    dimensionStatus?: DimensionStatus[];
  };
  rows?: LegacyRow[];
};

const integer = (value: number) => new Intl.NumberFormat("en-US").format(Number(value || 0));
const label = (value: string) => value.replace(/^guide_/, "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
const rate = (numerator: number, denominator: number) => denominator > 0 ? (numerator / denominator) * 100 : null;
const percentage = (value: number | null) => value === null ? "—" : `${value.toFixed(2)}%`;

function PerformanceChart({ rows }: { rows: TimeRow[] }) {
  if (!rows.length) return <Empty description="No venue performance data" />;
  const width = 900;
  const height = 240;
  const padding = 24;
  const max = Math.max(1, ...rows.flatMap((row) => [row.impressions, row.actions]));
  const point = (value: number, index: number) => {
    const x = rows.length === 1 ? width / 2 : padding + (index / (rows.length - 1)) * (width - padding * 2);
    const y = height - padding - (value / max) * (height - padding * 2);
    return `${x},${y}`;
  };
  return (
    <div className="venue-chart" role="img" aria-label="Venue exposure over time">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="venue-chart__axis" />
        <polyline points={rows.map((row, index) => point(row.impressions, index)).join(" ")} className="venue-chart__line venue-chart__line--impressions" />
        <polyline points={rows.map((row, index) => point(row.actions, index)).join(" ")} className="venue-chart__line venue-chart__line--actions" />
      </svg>
      <div className="venue-chart__legend">
        <span><i className="venue-chart__key venue-chart__key--impressions" />Venue impressions</span>
        <span><i className="venue-chart__key venue-chart__key--actions" />Outbound actions</span>
        <span>{dayjs(rows[0].date).format("D MMM")} – {dayjs(rows.at(-1)?.date).format("D MMM")}</span>
      </div>
    </div>
  );
}

export default function GAGuideEngagement() {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(DEFAULT_RANGE);
  const [payload, setPayload] = useState<Payload>({});
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [chartVenueId, setChartVenueId] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ startDate: dateRange[0].format("YYYY-MM-DD"), endDate: dateRange[1].format("YYYY-MM-DD") });
        const response = await fetch(`${ENDPOINT}?${params}`, { credentials: "include", signal: controller.signal });
        const next = (await response.json().catch(() => ({}))) as Payload;
        if (!response.ok || next.ok === false) throw new Error(next.error || `Failed to load venue performance (${response.status})`);
        setPayload(next);
        const venues = next.venuePerformance?.venues || [];
        setSelectedVenueId((current) => venues.some((venue) => venue.venueId === current) ? current : venues.find((venue) => venue.venueId)?.venueId || "");
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") setError(String((loadError as Error).message || loadError));
      } finally {
        setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [dateRange]);

  const performance = payload.venuePerformance;
  const summary = performance?.totals || {};
  const venues = performance?.venues || [];
  const reportableVenues = venues.filter((venue) => venue.venueId);
  const selectedVenue = reportableVenues.find((venue) => venue.venueId === selectedVenueId);
  const minimumImpressions = payload.minimumActionRateImpressions || 100;
  const legacyRows = useMemo(() => payload.rows || [], [payload.rows]);
  const eventOptions = useMemo(() => [
    { label: "All guide events", value: "all" },
    ...Array.from(new Set(legacyRows.map((row) => row.eventName))).filter(Boolean).sort().map((value) => ({ label: label(value), value })),
  ], [legacyRows]);
  const filteredLegacyRows = eventFilter === "all" ? legacyRows : legacyRows.filter((row) => row.eventName === eventFilter);

  const chartRows = useMemo(() => {
    const grouped = new Map<string, TimeRow>();
    for (const row of performance?.timeSeries || []) {
      if (chartVenueId !== "all" && row.venueId !== chartVenueId) continue;
      const item = grouped.get(row.date) || { ...row, key: row.date, impressions: 0, actions: 0 };
      item.impressions += row.impressions;
      item.actions += row.actions;
      grouped.set(row.date, item);
    }
    return [...grouped.values()].sort((left, right) => left.date.localeCompare(right.date));
  }, [chartVenueId, performance?.timeSeries]);

  const topVenues = useMemo(() => {
    const measured = reportableVenues.filter((venue) => venue.impressions > 0);
    const top = (selector: (venue: VenueRow) => number, candidates = measured) => [...candidates].sort((left, right) => selector(right) - selector(left))[0];
    return [
      { title: "Most exposed", venue: top((venue) => venue.impressions), value: (venue: VenueRow) => integer(venue.impressions) },
      { title: "Highest action rate", venue: top((venue) => rate(venue.totalActions, venue.impressions) || 0, measured.filter((venue) => venue.impressions >= minimumImpressions)), value: (venue: VenueRow) => percentage(rate(venue.totalActions, venue.impressions)) },
      { title: "Most Instagram clicks", venue: top((venue) => venue.instagram, reportableVenues), value: (venue: VenueRow) => integer(venue.instagram) },
      { title: "Most directions clicks", venue: top((venue) => venue.directions, reportableVenues), value: (venue: VenueRow) => integer(venue.directions) },
      { title: "Most website clicks", venue: top((venue) => venue.website, reportableVenues), value: (venue: VenueRow) => integer(venue.website) },
    ];
  }, [minimumImpressions, reportableVenues]);

  const venueColumns: ColumnsType<VenueRow> = [
    { title: "Venue", fixed: "left", width: 220, render: (_, venue) => <Space direction="vertical" size={0}><Typography.Text strong>{venue.venueName}</Typography.Text><Typography.Text type="secondary" className="venue-id">{venue.venueId || "Missing venue_id"}</Typography.Text></Space> },
    { title: "Impressions", dataIndex: "impressions", align: "right", sorter: (a, b) => a.impressions - b.impressions, render: integer },
    { title: "Users exposed", dataIndex: "usersExposed", align: "right", sorter: (a, b) => a.usersExposed - b.usersExposed, render: integer },
    { title: "Engagements", dataIndex: "engagements", align: "right", sorter: (a, b) => a.engagements - b.engagements, render: integer },
    { title: "Instagram", dataIndex: "instagram", align: "right", render: integer },
    { title: "Directions", dataIndex: "directions", align: "right", render: integer },
    { title: "Website", dataIndex: "website", align: "right", render: integer },
    { title: "Other actions", dataIndex: "unclassified", align: "right", render: integer },
    { title: "Total actions", dataIndex: "totalActions", align: "right", sorter: (a, b) => a.totalActions - b.totalActions, render: (value) => <strong>{integer(value)}</strong> },
    { title: "Engagement rate", align: "right", render: (_, venue) => percentage(rate(venue.engagements, venue.impressions)) },
    { title: "Action rate", align: "right", render: (_, venue) => percentage(rate(venue.totalActions, venue.impressions)) },
  ];
  const breakdownColumns: ColumnsType<BreakdownRow> = [
    { title: "", dataIndex: "label", render: label },
    { title: "Impressions", dataIndex: "impressions", align: "right", render: integer },
    { title: "Users", dataIndex: "users", align: "right", render: integer },
    { title: "Actions", dataIndex: "actions", align: "right", render: integer },
    { title: "Action rate", align: "right", render: (_, row) => percentage(rate(row.actions, row.impressions)) },
  ];
  const legacyColumns: ColumnsType<LegacyRow> = [
    { title: "Event", dataIndex: "eventName", render: (value) => <Tag color="blue">{label(value)}</Tag> },
    { title: "Venue", render: (_, row) => row.venueName || row.venueId || row.venueSlug || "—" },
    { title: "Section", dataIndex: "guideSection", render: (value) => value ? label(value) : "—" },
    { title: "Context", render: (_, row) => [row.componentLocation, row.linkType, row.targetSection, row.selectedFilter, row.mapCategory].filter(Boolean).map(label).join(" · ") || "—" },
    { title: "Events", dataIndex: "eventCount", align: "right", sorter: (a, b) => a.eventCount - b.eventCount, render: integer },
    { title: "Users", dataIndex: "users", align: "right", render: integer },
  ];

  return (
    <div className="venue-performance">
      <header className="venue-performance__header">
        <div><Typography.Text type="secondary">Google Analytics · Venue Performance</Typography.Text><Typography.Title level={2}>Tracked Venue Impressions</Typography.Title><Typography.Paragraph type="secondary">Exposure and measurable action generated for venues. Current reliable impression source: {payload.source?.label || "Ahangama Guide"}.</Typography.Paragraph></div>
        <RangePicker value={dateRange} allowClear={false} onChange={(value) => value?.[0] && value?.[1] && setDateRange([value[0], value[1]])} />
      </header>
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {!loading && !Number(summary.impressions || 0) ? <Alert type="info" showIcon message="No venue impression data available" description="Exposure is never estimated from page views. This dashboard will populate after venue_impression events from /guide/ are processed by GA4." /> : null}

      <Spin spinning={loading}>
        <Row gutter={[12, 12]}>
          {[["Total venue impressions", summary.impressions], ["Unique users exposed", summary.usersExposed], ["Venue engagements", summary.engagements], ["Outbound actions", summary.outboundActions]].map(([title, value]) => <Col xs={12} lg={6} key={String(title)}><Card><Statistic title={title} value={Number(value || 0)} formatter={(item) => integer(Number(item))} /></Card></Col>)}
        </Row>
        <div className="venue-performance__rate"><span>Overall action rate</span><strong>{percentage(rate(Number(summary.outboundActions || 0), Number(summary.impressions || 0)))}</strong><small>Outbound actions / tracked venue impressions</small></div>

        <Card title="Venue funnel" className="venue-performance__panel"><div className="venue-funnel"><div><span>Exposure</span><strong>{integer(Number(summary.impressions || 0))}</strong><small>Venue impressions</small></div><b>↓</b><div><span>Engagement</span><strong>{integer(Number(summary.engagements || 0))}</strong><small>Venue interactions</small></div><b>↓</b><div><span>Action</span><strong>{integer(Number(summary.outboundActions || 0))}</strong><small>Outbound actions</small></div><b>↓</b><div><span>Conversion</span><strong className="venue-funnel__pending">Not yet attributable</strong><small>Purchases lack venue attribution</small></div></div></Card>

        <Card title="Venue performance" className="venue-performance__panel" styles={{ body: { padding: 0 } }} extra={<Typography.Text type="secondary">Select a row for details</Typography.Text>}><Table<VenueRow> rowKey="key" columns={venueColumns} dataSource={venues} pagination={{ pageSize: 25, showSizeChanger: true }} locale={{ emptyText: <Empty description="No measured venue activity" /> }} scroll={{ x: 1500 }} onRow={(venue) => ({ onClick: () => venue.venueId && setSelectedVenueId(venue.venueId), className: venue.venueId === selectedVenueId ? "venue-performance__selected-row" : "" })} /></Card>

        {selectedVenue ? <Card title={selectedVenue.venueName} className="venue-performance__panel" extra={<Tag>{dateRange[0].format("D MMM YYYY")} – {dateRange[1].format("D MMM YYYY")}</Tag>}><div className="venue-detail"><Detail title="Exposure" items={[["Venue impressions", integer(selectedVenue.impressions)], ["Unique users exposed", integer(selectedVenue.usersExposed)]]} /><Detail title="Engagement" items={[["Guide interactions", integer(selectedVenue.engagements)], ["Users interacted", integer(selectedVenue.usersEngaged || 0)], ["Lightbox opens", integer(selectedVenue.lightboxOpens)], ["Other interactions", integer(selectedVenue.otherInteractions)]]} /><Detail title="Actions" items={[["Instagram", integer(selectedVenue.instagram)], ["Directions", integer(selectedVenue.directions)], ["Website", integer(selectedVenue.website)], ["Unclassified", integer(selectedVenue.unclassified)], ["Total actions", integer(selectedVenue.totalActions)]]} /><Detail title="Performance" items={[["Engagement rate", percentage(rate(selectedVenue.engagements, selectedVenue.impressions))], ["Action rate", percentage(rate(selectedVenue.totalActions, selectedVenue.impressions))], ["Instagram rate", percentage(rate(selectedVenue.instagram, selectedVenue.impressions))], ["Directions rate", percentage(rate(selectedVenue.directions, selectedVenue.impressions))], ["Website rate", percentage(rate(selectedVenue.website, selectedVenue.impressions))]]} /></div></Card> : null}

        <Card title="Venue exposure over time" className="venue-performance__panel" extra={<Select value={chartVenueId} onChange={setChartVenueId} style={{ minWidth: 220 }} options={[{ label: "All venues", value: "all" }, ...reportableVenues.map((venue) => ({ label: venue.venueName, value: venue.venueId }))]} />}><PerformanceChart rows={chartRows} /></Card>

        <section className="venue-performance__rankings"><Typography.Title level={3}>Top venues</Typography.Title><Typography.Paragraph type="secondary">Highest action rate requires at least {integer(minimumImpressions)} impressions.</Typography.Paragraph><div className="venue-ranking-grid">{topVenues.map((item) => <div key={item.title}><span>{item.title}</span><strong>{item.venue?.venueName || "—"}</strong><small>{item.venue ? item.value(item.venue) : "No eligible venue"}</small></div>)}</div></section>

        <Row gutter={[16, 16]} className="venue-performance__panel"><Col xs={24} xl={12}><Card title="Exposure by guide section" styles={{ body: { padding: 0 } }}><Table rowKey="key" columns={breakdownColumns} dataSource={performance?.sections || []} pagination={false} locale={{ emptyText: <Empty description="No section data" /> }} /></Card></Col><Col xs={24} xl={12}><Card title="Exposure by component" styles={{ body: { padding: 0 } }}><Table rowKey="key" columns={breakdownColumns} dataSource={performance?.components || []} pagination={false} locale={{ emptyText: <Empty description="No component data" /> }} /></Card></Col></Row>

        <Card title="Position analysis" className="venue-performance__panel">{performance?.positions === null ? <Alert type="warning" showIcon message="Position reporting unavailable" description="position parameter may be collected, but it is not currently available as a GA4 custom dimension." /> : <Table rowKey="key" columns={breakdownColumns} dataSource={performance?.positions || []} pagination={false} locale={{ emptyText: <Empty description="No position data" /> }} />}</Card>

        <Row gutter={[16, 16]} className="venue-performance__panel"><Col xs={24} xl={12}><Card title="Analytics QA" styles={{ body: { padding: 0 } }}><Table<QualityRow> rowKey="metric" dataSource={performance?.qa || []} pagination={false} columns={[{ title: "Check", dataIndex: "metric", render: label }, { title: "Events", dataIndex: "count", align: "right", render: integer }, { title: "% of total", align: "right", render: (_, row) => percentage(rate(row.count, row.total)) }]} /></Card></Col><Col xs={24} xl={12}><Card title="GA4 custom dimensions" styles={{ body: { padding: 0 } }}><Table<DimensionStatus> rowKey="apiName" dataSource={performance?.dimensionStatus || []} pagination={false} columns={[{ title: "Parameter", dataIndex: "apiName", render: (value) => value.replace("customEvent:", "") }, { title: "Status", dataIndex: "registered", align: "right", render: (value) => <Tag color={value ? "green" : "gold"}>{value ? "Registered" : "Needs registration"}</Tag> }]} /></Card></Col></Row>

        <Collapse className="venue-performance__panel" items={[{ key: "legacy", label: "Existing guide engagement report", children: <><Space wrap style={{ marginBottom: 16 }}><Select value={eventFilter} options={eventOptions} onChange={setEventFilter} style={{ minWidth: 220 }} /><Typography.Text type="secondary">{integer(filteredLegacyRows.reduce((total, row) => total + row.eventCount, 0))} events</Typography.Text></Space><Table<LegacyRow> rowKey="key" columns={legacyColumns} dataSource={filteredLegacyRows} pagination={{ pageSize: 25, showSizeChanger: true }} locale={{ emptyText: <Empty description="No guide engagement" /> }} scroll={{ x: 960 }} /></> }]} />
      </Spin>
    </div>
  );
}

function Detail({ title, items }: { title: string; items: [string, string][] }) {
  return <div><h3>{title}</h3><dl>{items.map(([name, value]) => <div className="venue-detail__row" key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></div>;
}