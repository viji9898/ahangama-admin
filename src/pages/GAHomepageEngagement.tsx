import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  DownloadOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import "./GAHomepageEngagement.css";

const ENDPOINT = "/.netlify/functions/ga-homepage-engagement";

type Metric = { value: number | null; change: number | null };
type Filters = { device: string; channel: string; channels: string[] };
type Range = { startDate: string; endDate: string };
type TableRow = Record<string, string | number | null | undefined>;
type Payload = {
  ok?: boolean;
  error?: string | { message?: string };
  generatedAt?: string;
  ranges?: { current: Range; previous: Range; days: number };
  filters?: Filters;
  kpis?: Record<string, Metric>;
  trend?: Array<{
    date: string;
    users: number;
    engagedSessions: number;
    contentSelections: number;
    passCtaClicks: number;
  }>;
  sections?: TableRow[];
  content?: TableRow[];
  passConversion?: {
    rows: TableRow[];
    purchasesAvailable: boolean;
    purchaseNote: string;
  };
  utility?: TableRow[];
  breakdowns?: { devices: TableRow[]; channels: TableRow[] };
  diagnostics?: {
    lastEvents: Array<{ eventName: string; lastReceived: string | null }>;
    missingDimensions: string[];
    blankContentIds: number;
    blankSections: number;
    unexpectedPaths: TableRow[];
    apiErrors: Array<{ report: string; message: string }>;
    registrationNote: string;
  };
  warnings?: Array<{ report: string; message: string }>;
};

type Column = {
  key: string;
  label: string;
  format?: "number" | "percent" | "change";
};

const integer = (value: unknown) =>
  new Intl.NumberFormat("en-US").format(Number(value || 0));
const percent = (value: unknown) =>
  value == null ? "—" : `${(Number(value) * 100).toFixed(1)}%`;
const duration = (value: unknown) => {
  if (value == null) return "—";
  const seconds = Math.round(Number(value));
  return seconds >= 60
    ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    : `${seconds}s`;
};
const labelize = (value: unknown) =>
  String(value || "Unclassified")
    .replace(/^customEvent:/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatCell = (value: unknown, format?: Column["format"]) => {
  if (format === "percent" || format === "change") return percent(value);
  if (format === "number") return integer(value);
  return String(value ?? "—");
};
const csvValue = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

function DataTable({
  rows,
  columns,
  empty = "No data was returned for this period.",
}: {
  rows: TableRow[];
  columns: Column[];
  empty?: string;
}) {
  if (!rows.length) return <div className="home-ga__empty">{empty}</div>;
  return (
    <div className="home-ga__table-wrap">
      <table className="home-ga__table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.key || row.contentId || row.section || index)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={column.format ? "home-ga__numeric" : undefined}
                >
                  {column.key === "section" || column.key === "location"
                    ? labelize(row[column.key])
                    : formatCell(row[column.key], column.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GAHomepageEngagement() {
  const [days, setDays] = useState("28");
  const [startDate, setStartDate] = useState(
    dayjs().subtract(27, "day").format("YYYY-MM-DD"),
  );
  const [endDate, setEndDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [device, setDevice] = useState("all");
  const [channel, setChannel] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const forceRefreshRef = useRef(false);
  const [payload, setPayload] = useState<Payload>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [breakdown, setBreakdown] = useState<"devices" | "channels">(
    "devices",
  );
  const [trendMetric, setTrendMetric] = useState<
    "users" | "engagedSessions" | "contentSelections" | "passCtaClicks"
  >("users");
  const [contentQuery, setContentQuery] = useState("");
  const [contentType, setContentType] = useState("all");
  const [contentSection, setContentSection] = useState("all");
  const [contentSort, setContentSort] = useState("impressionUsers");
  const [contentPage, setContentPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ device, channel });
        if (days === "custom") {
          query.set("startDate", startDate);
          query.set("endDate", endDate);
          query.set("days", "28");
        } else {
          query.set("days", days);
        }
        if (forceRefreshRef.current) {
          query.set("refresh", "1");
          forceRefreshRef.current = false;
        }
        const response = await fetch(`${ENDPOINT}?${query}`, {
          credentials: "include",
          signal: controller.signal,
        });
        const next = (await response.json().catch(() => ({}))) as Payload;
        if (!response.ok || next.ok === false) {
          const message =
            typeof next.error === "string" ? next.error : next.error?.message;
          throw new Error(message || `Analytics request failed (${response.status})`);
        }
        setPayload(next);
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
  }, [channel, days, device, endDate, refreshKey, startDate]);

  const kpiDefinitions = [
    ["users", "Homepage users", "Unique users"],
    ["sessions", "Sessions", "Homepage sessions"],
    ["views", "Views", "Homepage screen page views"],
    ["engagedSessions", "Engaged sessions", "GA4 engaged sessions"],
    ["engagementRate", "Engagement rate", "Engaged sessions / sessions"],
    ["averageEngagementDuration", "Avg. engagement", "Per homepage user"],
    ["passCtaUsers", "Pass CTA users", "Unique CTA users"],
    ["passCtaRate", "Pass CTA rate", "Users clicking a Pass CTA"],
    ["newsletterUsers", "Newsletter users", "Successful signup users"],
    ["newsletterRate", "Newsletter rate", "Successful signups / users"],
    ["transportUsers", "Transport users", "Unique enquiry users"],
    ["transportRate", "Transport intent", "Transport users / users"],
  ] as const;
  const allContentRows = useMemo(() => payload.content || [], [payload.content]);
  const contentTypes = useMemo(
    () => [...new Set(allContentRows.map((row) => String(row.contentType || "content")))].sort(),
    [allContentRows],
  );
  const contentSections = useMemo(
    () => [...new Set(allContentRows.map((row) => String(row.location || "unclassified")))].sort(),
    [allContentRows],
  );
  const filteredContent = useMemo(() => {
    const normalizedQuery = contentQuery.trim().toLowerCase();
    return allContentRows
      .filter((row) =>
        (!normalizedQuery || [row.contentTitle, row.contentId, row.destination].join(" ").toLowerCase().includes(normalizedQuery)) &&
        (contentType === "all" || row.contentType === contentType) &&
        (contentSection === "all" || row.location === contentSection),
      )
      .sort((left, right) => Number(right[contentSort] || 0) - Number(left[contentSort] || 0));
  }, [allContentRows, contentQuery, contentSection, contentSort, contentType]);
  const contentPageSize = 15;
  const contentPageCount = Math.max(1, Math.ceil(filteredContent.length / contentPageSize));
  const contentRows = filteredContent.slice(
    (contentPage - 1) * contentPageSize,
    contentPage * contentPageSize,
  );
  useEffect(() => setContentPage(1), [contentQuery, contentSection, contentSort, contentType]);
  const maxTrendUsers = Math.max(
    1,
    ...(payload.trend || []).map((row) => row[trendMetric]),
  );
  const activeBreakdown = payload.breakdowns?.[breakdown] || [];

  const exportContent = () => {
    const columns = [
      "contentTitle",
      "contentType",
      "location",
      "position",
      "impressionUsers",
      "selectingUsers",
      "selections",
      "ctr",
      "change",
      "destination",
    ];
    const csv = [
      columns.map(csvValue).join(","),
      ...filteredContent.map((row) =>
        columns.map((column) => csvValue(row[column])).join(","),
      ),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `homepage-content-${payload.ranges?.current.startDate || "export"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="home-ga" aria-busy={loading}>
      <header className="home-ga__header">
        <div>
          <p>Homepage Engagement</p>
          <h1>Homepage performance</h1>
          <span>Audience, discovery and high-intent actions on ahangama.com/</span>
        </div>
        <button
          className="home-ga__icon-button"
          onClick={() => {
            forceRefreshRef.current = true;
            setRefreshKey((value) => value + 1);
          }}
          aria-label="Refresh analytics"
          title="Refresh analytics"
        >
          <ReloadOutlined spin={loading} />
        </button>
      </header>

      <div className="home-ga__filters">
        <label>
          <span>Period</span>
          <select value={days} onChange={(event) => setDays(event.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="28">Last 28 days</option>
            <option value="90">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {days === "custom" ? (
          <>
            <label><span>Start</span><input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label><span>End</span><input type="date" value={endDate} min={startDate} max={dayjs().format("YYYY-MM-DD")} onChange={(event) => setEndDate(event.target.value)} /></label>
          </>
        ) : null}
        <label>
          <span>Device</span>
          <select value={device} onChange={(event) => setDevice(event.target.value)}>
            <option value="all">All devices</option>
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
            <option value="tablet">Tablet</option>
          </select>
        </label>
        <label>
          <span>Channel</span>
          <select value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="all">All channels</option>
            {(payload.filters?.channels || []).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className="home-ga__period-note">
          <span>Compared with previous period</span>
          <strong>
            {payload.ranges
              ? `${dayjs(payload.ranges.current.startDate).format("D MMM")}–${dayjs(payload.ranges.current.endDate).format("D MMM YYYY")}`
              : "Loading period"}
          </strong>
        </div>
      </div>

      {loading && !payload.ok ? (
        <div className="home-ga__state"><span className="stats-loader__icon" />Loading homepage analytics</div>
      ) : null}
      {error ? (
        <div className="home-ga__state home-ga__state--error">
          <WarningOutlined /><strong>Homepage analytics unavailable</strong><span>{error}</span>
        </div>
      ) : null}

      {!error && payload.ok ? (
        <>
          {payload.warnings?.length ? (
            <div className="home-ga__notice">
              <WarningOutlined /> {payload.warnings.length} report{payload.warnings.length === 1 ? "" : "s"} could not be loaded. Available sections remain visible.
            </div>
          ) : null}

          <div className="home-ga__kpis">
            {kpiDefinitions.map(([key, title, detail]) => {
              const metric = payload.kpis?.[key];
              const isRate = key.endsWith("Rate");
              const value = key === "averageEngagementDuration"
                ? duration(metric?.value)
                : isRate ? percent(metric?.value) : integer(metric?.value);
              return (
                <article key={key}>
                  <span>{title}</span>
                  <strong>{value}</strong>
                  <small>{detail}</small>
                  <em className={(metric?.change || 0) < 0 ? "is-negative" : ""}>
                    {metric?.change == null ? "No comparison" : `${Number(metric.change) >= 0 ? "+" : ""}${percent(metric.change)} vs prior`}
                  </em>
                </article>
              );
            })}
          </div>

          <div className="home-ga__grid home-ga__grid--lead">
            <article className="home-ga__panel">
              <div className="home-ga__panel-heading">
                <div><p>Daily trend</p><h2>Audience and intent</h2></div>
                <div className="home-ga__tabs" role="tablist">
                  {([
                    ["users", "Users"],
                    ["engagedSessions", "Engaged"],
                    ["contentSelections", "Selections"],
                    ["passCtaClicks", "Pass clicks"],
                  ] as const).map(([key, label]) => (
                    <button key={key} className={trendMetric === key ? "is-active" : ""} onClick={() => setTrendMetric(key)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="home-ga__trend" aria-label="Daily homepage user trend">
                {(payload.trend || []).map((row) => (
                  <div className="home-ga__trend-item" key={row.date} title={`${integer(row.users)} users on ${row.date}`}>
                    <div className="home-ga__trend-value">{integer(row[trendMetric])}</div>
                    <div className="home-ga__trend-track">
                      <div style={{ height: `${Math.max(3, (row[trendMetric] / maxTrendUsers) * 100)}%` }} />
                    </div>
                    <span>{dayjs(row.date).format(payload.ranges?.days === 90 ? "D" : "D MMM")}</span>
                    <small>{row.contentSelections} sel · {row.passCtaClicks} pass</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="home-ga__panel">
              <div className="home-ga__panel-heading"><div><p>Pass conversion</p><h2>CTA intent</h2></div><span>User-based rate</span></div>
              <DataTable rows={payload.passConversion?.rows || []} columns={[
                { key: "location", label: "CTA location" },
                { key: "users", label: "Users", format: "number" },
                { key: "clicks", label: "Clicks", format: "number" },
                { key: "clickRate", label: "Rate", format: "percent" },
              ]} />
              <p className="home-ga__footnote">{payload.passConversion?.purchaseNote}</p>
            </article>
          </div>

          <article className="home-ga__panel">
            <div className="home-ga__panel-heading"><div><p>Section funnel</p><h2>How far users travel down the homepage</h2></div><span>Ordered by page position</span></div>
            <DataTable rows={payload.sections || []} columns={[
              { key: "section", label: "Section" },
              { key: "users", label: "Reached users", format: "number" },
              { key: "reachRate", label: "Homepage reach", format: "percent" },
              { key: "dropOffRate", label: "Drop-off", format: "percent" },
              { key: "impressions", label: "Impressions", format: "number" },
              { key: "selections", label: "Selections", format: "number" },
              { key: "ctr", label: "User CTR", format: "percent" },
            ]} />
          </article>

          <article className="home-ga__panel">
            <div className="home-ga__panel-heading">
              <div><p>Content performance</p><h2>What earns attention and action</h2></div>
              <button className="home-ga__button" onClick={exportContent} disabled={!filteredContent.length}><DownloadOutlined /> Export CSV</button>
            </div>
            <div className="home-ga__content-controls">
              <label><span>Search</span><input type="search" value={contentQuery} placeholder="Title, ID or destination" onChange={(event) => setContentQuery(event.target.value)} /></label>
              <label><span>Type</span><select value={contentType} onChange={(event) => setContentType(event.target.value)}><option value="all">All types</option>{contentTypes.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select></label>
              <label><span>Section</span><select value={contentSection} onChange={(event) => setContentSection(event.target.value)}><option value="all">All sections</option>{contentSections.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select></label>
              <label><span>Sort</span><select value={contentSort} onChange={(event) => setContentSort(event.target.value)}><option value="impressionUsers">Most seen</option><option value="selectingUsers">Most selectors</option><option value="selections">Most selections</option><option value="ctr">Highest CTR</option><option value="change">Largest CTR change</option></select></label>
            </div>
            <DataTable rows={contentRows} columns={[
              { key: "contentTitle", label: "Content" },
              { key: "contentType", label: "Type" },
              { key: "location", label: "Location" },
              { key: "position", label: "Position" },
              { key: "impressionUsers", label: "Seen by", format: "number" },
              { key: "selectingUsers", label: "Selected by", format: "number" },
              { key: "selections", label: "Selections", format: "number" },
              { key: "ctr", label: "User CTR", format: "percent" },
              { key: "change", label: "CTR change", format: "change" },
              { key: "destination", label: "Destination" },
            ]} />
            <div className="home-ga__pagination"><span>{integer(filteredContent.length)} results</span><div><button disabled={contentPage === 1} onClick={() => setContentPage((value) => value - 1)}>Previous</button><span>{contentPage} / {contentPageCount}</span><button disabled={contentPage === contentPageCount} onClick={() => setContentPage((value) => value + 1)}>Next</button></div></div>
          </article>

          <div className="home-ga__grid">
            <article className="home-ga__panel">
              <div className="home-ga__panel-heading"><div><p>Utility engagement</p><h2>Tasks users complete</h2></div></div>
              <DataTable rows={payload.utility || []} columns={[
                { key: "label", label: "Action" },
                { key: "users", label: "Users", format: "number" },
                { key: "actions", label: "Actions", format: "number" },
              ]} />
            </article>
            <article className="home-ga__panel">
              <div className="home-ga__panel-heading">
                <div><p>Audience quality</p><h2>Segment comparison</h2></div>
                <div className="home-ga__tabs" role="tablist">
                  <button className={breakdown === "devices" ? "is-active" : ""} onClick={() => setBreakdown("devices")}>Device</button>
                  <button className={breakdown === "channels" ? "is-active" : ""} onClick={() => setBreakdown("channels")}>Channel</button>
                </div>
              </div>
              <DataTable rows={activeBreakdown} columns={[
                { key: "key", label: breakdown === "devices" ? "Device" : "Channel" },
                { key: "users", label: "Users", format: "number" },
                { key: "engagementRate", label: "Engaged", format: "percent" },
                { key: "contentCtr", label: "Content CTR", format: "percent" },
                { key: "passCtaRate", label: "Pass rate", format: "percent" },
                { key: "newsletterRate", label: "Signup rate", format: "percent" },
              ]} />
            </article>
          </div>

          <article className="home-ga__panel home-ga__health">
            <div className="home-ga__panel-heading"><div><p>Tracking health</p><h2>Instrumentation coverage</h2></div><span>Generated {dayjs(payload.generatedAt).format("D MMM, HH:mm")}</span></div>
            <div className="home-ga__health-grid">
              <div><strong>{payload.diagnostics?.missingDimensions.length || 0}</strong><span>Missing custom dimensions</span></div>
              <div><strong>{integer(payload.diagnostics?.blankContentIds)}</strong><span>Content events without IDs</span></div>
              <div><strong>{integer(payload.diagnostics?.blankSections)}</strong><span>Section views without names</span></div>
              <div><strong>{payload.diagnostics?.apiErrors.length || 0}</strong><span>GA4 report errors</span></div>
            </div>
            <details>
              <summary>Tracking details</summary>
              <div className="home-ga__details-grid">
                <div><h3>Latest event received</h3>{payload.diagnostics?.lastEvents.map((event) => <p key={event.eventName}><span>{event.eventName}</span><strong>{event.lastReceived ? dayjs(event.lastReceived, "YYYYMMDDHHmm").format("D MMM HH:mm") : "Not received"}</strong></p>)}</div>
                <div><h3>Missing dimensions</h3>{payload.diagnostics?.missingDimensions.length ? payload.diagnostics.missingDimensions.map((value) => <p key={value}>{value}</p>) : <p>All requested dimensions are registered.</p>}<small>{payload.diagnostics?.registrationNote}</small></div>
                <div><h3>Unexpected page paths</h3>{payload.diagnostics?.unexpectedPaths.length ? payload.diagnostics.unexpectedPaths.map((row, index) => <p key={`${row.path}:${row.eventName}:${index}`}><span>{String(row.path)} · {String(row.eventName)}</span><strong>{integer(row.events)}</strong></p>) : <p>No unexpected paths found.</p>}</div>
                <div><h3>Data API errors</h3>{payload.diagnostics?.apiErrors.length ? payload.diagnostics.apiErrors.map((item) => <p key={item.report}><span>{item.report}</span><strong>{item.message}</strong></p>) : <p>No report errors.</p>}</div>
              </div>
            </details>
          </article>
        </>
      ) : null}
    </section>
  );
}
