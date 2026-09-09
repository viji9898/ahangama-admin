import { useEffect, useState } from "react";
import "./ArticleInsights.css";

const ENDPOINT = "/.netlify/functions/api-article-insights";
const DEFAULT_CONTENT_ID =
  "the-mugatiya-a-heritage-villa-made-for-slower-days-in-ahangama";

type Rate = number | null;
type Status = { apiName: string; registered: boolean };
type Kpis = {
  views: number;
  engagedReads: number;
  qualifiedReadRate: Rate;
  completions: number;
  completionRate: Rate;
  averageActiveReadSeconds: Rate;
  outboundClicks: number;
  placeIntentRate: Rate;
  nextSelections: number;
  continuationRate: Rate;
};
type Payload = {
  ok?: boolean;
  available?: boolean;
  error?: string;
  selectedContentId?: string;
  kpis?: Kpis;
  funnel?: Array<{ label: string; value: number }>;
  sections?: Array<{
    key: string;
    articleSection: string;
    pagePath: string;
    views: number;
    engagedReaderReach: Rate;
  }>;
  discovery?: Array<{
    componentLocation: string;
    impressions: number;
    selections: number;
    ctr: Rate;
  }>;
  trafficQuality?: Array<{
    key: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    views: number;
    qualifiedReadRate: Rate;
    completionRate: Rate;
    averageActiveReadSeconds: Rate;
  }>;
  outboundIntent?: Array<{
    key: number;
    articleSection: string;
    linkType: string;
    destinationUrl: string;
    sourceDomain: string;
    clicks: number;
  }>;
  continuation?: Array<{
    targetContentId: string;
    selections: number;
    continuationRate: Rate;
  }>;
  filters?: {
    articles?: Array<{
      contentId: string;
      contentTitle: string;
      articleCategory: string;
    }>;
    categories?: string[];
    trafficSources?: string[];
    devices?: string[];
  };
  dimensionStatus?: Status[];
  metricStatus?: Status;
  warnings?: Array<{ report: string; message: string }>;
  quota?: {
    successfulReports: number;
    failedReports: number;
    coreTokensConsumed: number;
    projectTokensRemainingThisHour: number | null;
    propertyTokensRemainingThisHour: number | null;
    propertyTokensRemainingToday: number | null;
    concurrentRequestsRemaining: number | null;
    serverErrorsRemainingThisHour: number | null;
  };
  limitations?: string[];
};

type Filters = {
  startDate: string;
  endDate: string;
  contentId: string;
  category: string;
  trafficSource: string;
  device: string;
};

const dateValue = (date: Date) => date.toISOString().slice(0, 10);
const initialFilters = (days: number): Filters => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return {
    startDate: dateValue(start),
    endDate: dateValue(end),
    contentId: DEFAULT_CONTENT_ID,
    category: "all",
    trafficSource: "all",
    device: "all",
  };
};
const number = (value?: number | null) =>
  value === undefined || value === null
    ? "—"
    : new Intl.NumberFormat("en-US").format(value);
const rate = (value?: Rate) =>
  value === undefined || value === null || !Number.isFinite(value)
    ? "—"
    : `${(value * 100).toFixed(1)}%`;
const duration = (value?: Rate) =>
  value === undefined || value === null || !Number.isFinite(value)
    ? "—"
    : `${Math.round(value)}s`;
const label = (value: string) =>
  value
    .replace(/^customEvent:/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

function SelectFilter({
  labelText,
  value,
  options,
  onChange,
}: {
  labelText: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="article-insights__filter">
      <span>{labelText}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DataTable({
  headings,
  children,
  empty,
}: {
  headings: string[];
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <div className="article-insights__table" role="table">
      <div
        className="article-insights__table-head"
        role="row"
        style={{ "--columns": headings.length } as React.CSSProperties}
      >
        {headings.map((heading) => (
          <span key={heading}>{heading}</span>
        ))}
      </div>
      {empty ? (
        <p className="article-insights__empty">
          No matching data for this period.
        </p>
      ) : (
        children
      )}
    </div>
  );
}

export default function ArticleInsights({ days }: { days: number }) {
  const [filters, setFilters] = useState(() => initialFilters(days));
  const [payload, setPayload] = useState<Payload>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setFilters((current) => ({
      ...initialFilters(days),
      contentId: current.contentId,
    }));
  }, [days]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams(filters);
        const response = await fetch(`${ENDPOINT}?${params}`, {
          credentials: "include",
          signal: controller.signal,
        });
        const next = (await response.json().catch(() => ({}))) as Payload;
        if (!response.ok || next.ok === false || next.available === false) {
          throw new Error(
            next.error ||
              `Unable to load Article Insights (${response.status})`,
          );
        }
        setPayload(next);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError")
          setError((loadError as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [filters]);

  const update = (key: keyof Filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const kpis = payload.kpis;
  const maxFunnel = Math.max(
    ...(payload.funnel || []).map((item) => item.value),
    1,
  );
  const kpiItems: Array<[string, string, string]> = [
    ["Article views", number(kpis?.views), "Unique per-render view milestones"],
    [
      "Engaged reads",
      number(kpis?.engagedReads),
      "15 active seconds + 25% depth",
    ],
    [
      "Qualified-read rate",
      rate(kpis?.qualifiedReadRate),
      "Engaged reads / views",
    ],
    ["Completions", number(kpis?.completions), "30 active seconds + 90% depth"],
    [
      "Completion rate",
      rate(kpis?.completionRate),
      "Completions / engaged reads",
    ],
    [
      "Avg active reading",
      duration(kpis?.averageActiveReadSeconds),
      "Active seconds / engaged reads",
    ],
    [
      "Outbound place clicks",
      number(kpis?.outboundClicks),
      "Anonymous outbound events",
    ],
    [
      "Place-intent rate",
      rate(kpis?.placeIntentRate),
      "Outbound clicks / engaged reads",
    ],
    [
      "Next-article selections",
      number(kpis?.nextSelections),
      "Article footer selections",
    ],
    [
      "Continuation rate",
      rate(kpis?.continuationRate),
      "Next selections / completions",
    ],
  ];

  return (
    <section className="article-insights" id="articles" aria-busy={loading}>
      <div className="article-insights__heading">
        <div>
          <p>Article Insights</p>
          <h3>How readers move through a story</h3>
        </div>
        <span>Anonymous GA4 events only</span>
      </div>

      <div className="article-insights__filters">
        <SelectFilter
          labelText="Article"
          value={filters.contentId}
          onChange={(value) => update("contentId", value)}
          options={[
            ...(!(payload.filters?.articles || []).some(
              (item) => item.contentId === filters.contentId,
            )
              ? [{ value: filters.contentId, label: label(filters.contentId) }]
              : []),
            ...(payload.filters?.articles || []).map((item) => ({
              value: item.contentId,
              label: item.contentTitle,
            })),
          ]}
        />
        <label className="article-insights__filter">
          <span>Start date</span>
          <input
            type="date"
            value={filters.startDate}
            max={filters.endDate}
            onChange={(event) => update("startDate", event.target.value)}
          />
        </label>
        <label className="article-insights__filter">
          <span>End date</span>
          <input
            type="date"
            value={filters.endDate}
            min={filters.startDate}
            max={dateValue(new Date())}
            onChange={(event) => update("endDate", event.target.value)}
          />
        </label>
        <SelectFilter
          labelText="Category"
          value={filters.category}
          onChange={(value) => update("category", value)}
          options={[
            { value: "all", label: "All categories" },
            ...(payload.filters?.categories || []).map((item) => ({
              value: item,
              label: label(item),
            })),
          ]}
        />
        <SelectFilter
          labelText="Traffic source"
          value={filters.trafficSource}
          onChange={(value) => update("trafficSource", value)}
          options={[
            { value: "all", label: "All sources" },
            ...(payload.filters?.trafficSources || []).map((item) => ({
              value: item,
              label: item,
            })),
          ]}
        />
        <SelectFilter
          labelText="Device"
          value={filters.device}
          onChange={(value) => update("device", value)}
          options={[
            { value: "all", label: "All devices" },
            ...(payload.filters?.devices || []).map((item) => ({
              value: item,
              label: label(item),
            })),
          ]}
        />
      </div>

      {loading ? (
        <div className="article-insights__state">
          <span className="stats-loader__icon" />
          Loading Article Insights
        </div>
      ) : null}
      {!loading && error ? (
        <div className="article-insights__state article-insights__state--error">
          <strong>Article Insights unavailable</strong>
          <span>{error}</span>
        </div>
      ) : null}
      {!loading && !error && kpis ? (
        <>
          {payload.warnings?.length ? (
            <div className="article-insights__state article-insights__state--warning">
              <strong>Some GA4 reports are temporarily unavailable</strong>
              <span>
                {payload.warnings
                  .map((warning) => label(warning.report))
                  .join(", ")}
                . Available data is shown below; retry later.
              </span>
            </div>
          ) : null}
          <div className="article-insights__kpis">
            {kpiItems.map(([title, value, detail]) => (
              <article key={title}>
                <strong>{value}</strong>
                <span>{title}</span>
                <small>{detail}</small>
              </article>
            ))}
          </div>
          {!kpis.views ? (
            <div className="article-insights__state">
              <strong>No article views</strong>
              <span>
                Try another article, date range, source, category, or device.
              </span>
            </div>
          ) : null}

          <div className="article-insights__panel">
            <h4>Reading funnel</h4>
            <div className="article-insights__funnel">
              {(payload.funnel || []).map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <i
                    style={{
                      width: `${Math.max((item.value / maxFunnel) * 100, item.value ? 2 : 0)}%`,
                    }}
                  />
                  <strong>{number(item.value)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="article-insights__panel">
            <h4>Section reach</h4>
            <DataTable
              headings={[
                "Section",
                "Page path",
                "Views",
                "% of engaged readers",
              ]}
              empty={!payload.sections?.length}
            >
              {(payload.sections || []).map((item) => (
                <div
                  className="article-insights__table-row"
                  role="row"
                  style={{ "--columns": 4 } as React.CSSProperties}
                  key={item.key}
                >
                  <strong>{label(item.articleSection)}</strong>
                  <span>{item.pagePath || "—"}</span>
                  <span>{number(item.views)}</span>
                  <span>{rate(item.engagedReaderReach)}</span>
                </div>
              ))}
            </DataTable>
          </div>

          <div className="article-insights__panel">
            <h4>Discovery performance</h4>
            <DataTable
              headings={["Placement", "Card impressions", "Selections", "CTR"]}
              empty={!payload.discovery?.length}
            >
              {(payload.discovery || []).map((item) => (
                <div
                  className="article-insights__table-row"
                  role="row"
                  style={{ "--columns": 4 } as React.CSSProperties}
                  key={item.componentLocation}
                >
                  <strong>{label(item.componentLocation)}</strong>
                  <span>{number(item.impressions)}</span>
                  <span>{number(item.selections)}</span>
                  <span>{rate(item.ctr)}</span>
                </div>
              ))}
            </DataTable>
          </div>

          <div className="article-insights__panel">
            <h4>Traffic quality</h4>
            <DataTable
              headings={[
                "Source / medium",
                "Campaign",
                "Views",
                "Qualified",
                "Completion",
                "Avg active",
              ]}
              empty={!payload.trafficQuality?.length}
            >
              {(payload.trafficQuality || []).map((item) => (
                <div
                  className="article-insights__table-row"
                  role="row"
                  style={{ "--columns": 6 } as React.CSSProperties}
                  key={item.key}
                >
                  <strong>
                    {item.utmSource} / {item.utmMedium}
                  </strong>
                  <span>{item.utmCampaign}</span>
                  <span>{number(item.views)}</span>
                  <span>{rate(item.qualifiedReadRate)}</span>
                  <span>{rate(item.completionRate)}</span>
                  <span>{duration(item.averageActiveReadSeconds)}</span>
                </div>
              ))}
            </DataTable>
          </div>

          <div className="article-insights__panel">
            <h4>Outbound intent</h4>
            <DataTable
              headings={["Section", "Link type", "Destination", "Clicks"]}
              empty={!payload.outboundIntent?.length}
            >
              {(payload.outboundIntent || []).map((item) => (
                <div
                  className="article-insights__table-row"
                  role="row"
                  style={{ "--columns": 4 } as React.CSSProperties}
                  key={item.key}
                >
                  <strong>{label(item.articleSection)}</strong>
                  <span>{label(item.linkType)}</span>
                  <span className="article-insights__destination">
                    {item.destinationUrl || item.sourceDomain || "—"}
                  </span>
                  <span>{number(item.clicks)}</span>
                </div>
              ))}
            </DataTable>
          </div>

          <div className="article-insights__panel">
            <h4>Article continuation</h4>
            <DataTable
              headings={["Target article", "Selections", "Continuation rate"]}
              empty={!payload.continuation?.length}
            >
              {(payload.continuation || []).map((item) => (
                <div
                  className="article-insights__table-row"
                  role="row"
                  style={{ "--columns": 3 } as React.CSSProperties}
                  key={item.targetContentId}
                >
                  <strong>{label(item.targetContentId)}</strong>
                  <span>{number(item.selections)}</span>
                  <span>{rate(item.continuationRate)}</span>
                </div>
              ))}
            </DataTable>
          </div>

          <div className="article-insights__qa">
            <div>
              <h4>GA4 custom definitions</h4>
              {[
                ...(payload.dimensionStatus || []),
                ...(payload.metricStatus ? [payload.metricStatus] : []),
              ].map((item) => (
                <p key={item.apiName}>
                  <span>{item.apiName.replace("customEvent:", "")}</span>
                  <strong data-ready={item.registered}>
                    {item.registered ? "Registered" : "Needs registration"}
                  </strong>
                </p>
              ))}
            </div>
            <div>
              <h4>GA4 quota usage</h4>
              {payload.quota ? (
                <>
                  <p>
                    <span>Reports completed</span>
                    <strong>{payload.quota.successfulReports} / 9</strong>
                  </p>
                  <p>
                    <span>Reports failed</span>
                    <strong>{payload.quota.failedReports}</strong>
                  </p>
                  <p>
                    <span>Core tokens used by this load</span>
                    <strong>{number(payload.quota.coreTokensConsumed)}</strong>
                  </p>
                  <p>
                    <span>Project tokens left this hour</span>
                    <strong>
                      {number(payload.quota.projectTokensRemainingThisHour)}
                    </strong>
                  </p>
                  <p>
                    <span>Property tokens left this hour</span>
                    <strong>
                      {number(payload.quota.propertyTokensRemainingThisHour)}
                    </strong>
                  </p>
                  <p>
                    <span>Property tokens left today</span>
                    <strong>
                      {number(payload.quota.propertyTokensRemainingToday)}
                    </strong>
                  </p>
                  <p>
                    <span>Concurrent request slots left</span>
                    <strong>
                      {number(payload.quota.concurrentRequestsRemaining)}
                    </strong>
                  </p>
                  <p>
                    <span>Server errors left this hour</span>
                    <strong>
                      {number(payload.quota.serverErrorsRemainingThisHour)}
                    </strong>
                  </p>
                </>
              ) : (
                <p>
                  Quota telemetry is unavailable until a GA4 report succeeds.
                </p>
              )}
            </div>
            <div>
              <h4>Reporting notes</h4>
              {(payload.limitations || []).map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
