import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "./GAInstagramEngagement.css";

const ENDPOINT = "/.netlify/functions/ga-instagram-engagement";

type MetricKey = "views" | "reach" | "interactions" | "follows";
type SortKey = "views" | "reach" | "interactions" | "saved" | "engagementRate";
type Metrics = {
  views: number;
  reach: number;
  accountsEngaged?: number;
  interactions: number;
  profileViews?: number;
  websiteClicks?: number;
  profileLinkTaps?: number;
  follows?: number;
  unfollows?: number;
};
type InstagramPost = {
  id: string;
  caption: string;
  mediaType: string;
  mediaProductType: string;
  permalink: string;
  timestamp: string;
  imageUrl: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  interactions: number;
  handles: string[];
};
type Report = {
  days: number;
  range: { start: string; end: string; previousStart: string; previousEnd: string };
  totals: Metrics & { posts: number; interactionRate: number };
  previousTotals: Metrics & { posts: number; interactionRate: number };
  formats: Array<Metrics & { format: string; posts: number }>;
  posts: InstagramPost[];
};
type DailyPoint = { date: string; views: number; reach: number; interactions: number; follows: number };
type InstagramStory = {
  id: string;
  caption: string;
  permalink: string;
  timestamp: string;
  imageUrl: string;
  views: number;
  reach: number;
  replies: number;
  shares: number;
  interactions: number;
  profileActivity: number;
  navigation: number;
};
type Payload = {
  ok?: boolean;
  error?: string;
  generatedAt?: string;
  username?: string;
  profile?: { followers: number; mediaCount: number; pictureUrl: string };
  account?: Metrics;
  previousAccount?: Metrics;
  timeSeries?: DailyPoint[];
  previousTimeSeries?: DailyPoint[];
  stories?: { available: boolean; stories: InstagramStory[]; reason?: string };
  paid?: { available: boolean; reason: string };
  report?: Report;
  posts?: InstagramPost[];
};

const integer = (value = 0) => new Intl.NumberFormat("en-US").format(Number(value || 0));
const compact = (value = 0) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
const rate = (post: InstagramPost) => post.reach ? (post.interactions / post.reach) * 100 : 0;
const formatName = (post: InstagramPost) => {
  const value = post.mediaProductType || post.mediaType || "POST";
  if (value === "REELS") return "Reel";
  if (value === "CAROUSEL_ALBUM") return "Carousel";
  if (value === "FEED" && post.mediaType === "CAROUSEL_ALBUM") return "Carousel";
  if (post.mediaType === "VIDEO") return "Video";
  if (post.mediaType === "IMAGE") return "Photo";
  return value.charAt(0) + value.slice(1).toLowerCase();
};
const change = (current = 0, previous = 0) => {
  if (!previous) return { label: current ? "New activity" : "No change", value: current ? 100 : 0 };
  const value = ((current - previous) / previous) * 100;
  return { label: `${value >= 0 ? "+" : ""}${value.toFixed(0)}%`, value };
};

function TrendChart({ points, previousPoints, metric }: { points: DailyPoint[]; previousPoints: DailyPoint[]; metric: MetricKey }) {
  const width = 900;
  const height = 310;
  const margin = { left: 52, right: 18, top: 22, bottom: 38 };
  const values = [...points, ...previousPoints].map((point) => point[metric]);
  const maximum = Math.max(...values, 1);
  const x = (index: number) => margin.left + (index * (width - margin.left - margin.right)) / Math.max(points.length - 1, 1);
  const y = (value: number) => height - margin.bottom - (value / maximum) * (height - margin.top - margin.bottom);
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point[metric]).toFixed(1)}`).join(" ");
  const previousPath = previousPoints.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point[metric]).toFixed(1)}`).join(" ");
  const labels = points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.max(Math.floor(points.length / 5), 1) === 0);

  return (
    <svg className="ig-report__chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily Instagram ${metric}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((step) => (
        <g key={step}>
          <line x1={margin.left} x2={width - margin.right} y1={y(maximum * step)} y2={y(maximum * step)} />
          <text x={margin.left - 9} y={y(maximum * step) + 4} textAnchor="end">{compact(maximum * step)}</text>
        </g>
      ))}
      {labels.map((point) => {
        const index = points.indexOf(point);
        return <text key={point.date} x={x(index)} y={height - 10} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>{dayjs(point.date).format("D MMM")}</text>;
      })}
      <path className="ig-report__chart-line ig-report__chart-line--previous" d={previousPath} />
      <path className="ig-report__chart-line" d={path} />
      {points.map((point, index) => (
        <circle key={point.date} cx={x(index)} cy={y(point[metric])} r="4">
          <title>{dayjs(point.date).format("D MMM YYYY")}: {integer(point[metric])} {metric}</title>
        </circle>
      ))}
    </svg>
  );
}

export default function GAInstagramEngagement() {
  const [days, setDays] = useState(30);
  const [payload, setPayload] = useState<Payload>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState<MetricKey>("views");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("reach");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${ENDPOINT}?days=${days}`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        const next = (await response.json().catch(() => ({}))) as Payload;
        if (!response.ok || next.ok === false) throw new Error(next.error || `Unable to load Instagram stats (${response.status})`);
        setPayload(next);
      })
      .catch((loadError: Error) => { if (loadError.name !== "AbortError") setError(loadError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [days]);

  const report = payload.report;
  const posts = useMemo(() => report?.posts || [], [report?.posts]);
  const postDailyPoints = useMemo(() => {
    const start = report ? dayjs(report.range.start).startOf("day") : dayjs().subtract(days, "day").startOf("day");
    return Array.from({ length: days }, (_, index) => {
      const date = start.add(index, "day");
      const dayPosts = posts.filter((post) => dayjs(post.timestamp).isSame(date, "day"));
      return {
        date: date.format("YYYY-MM-DD"),
        views: dayPosts.reduce((sum, post) => sum + post.views, 0),
        reach: dayPosts.reduce((sum, post) => sum + post.reach, 0),
        interactions: dayPosts.reduce((sum, post) => sum + post.interactions, 0),
        follows: 0,
      };
    });
  }, [days, posts, report]);
  const previousPostDailyPoints = useMemo(() => {
    const start = report ? dayjs(report.range.previousStart).startOf("day") : dayjs().subtract(days * 2, "day").startOf("day");
    const previousPosts = (payload.posts || []).filter((post) => {
      const timestamp = dayjs(post.timestamp);
      return report && timestamp.valueOf() >= dayjs(report.range.previousStart).valueOf() && timestamp.valueOf() < dayjs(report.range.previousEnd).valueOf();
    });
    return Array.from({ length: days }, (_, index) => {
      const date = start.add(index, "day");
      const dayPosts = previousPosts.filter((post) => dayjs(post.timestamp).isSame(date, "day"));
      return {
        date: date.format("YYYY-MM-DD"),
        views: dayPosts.reduce((sum, post) => sum + post.views, 0),
        reach: dayPosts.reduce((sum, post) => sum + post.reach, 0),
        interactions: dayPosts.reduce((sum, post) => sum + post.interactions, 0),
        follows: 0,
      };
    });
  }, [days, payload.posts, report]);
  const dailyPoints = useMemo(() => {
    const metaSeries = payload.timeSeries || [];
    const hasMetaMetric = metric === "reach" || metric === "follows";
    if (!hasMetaMetric) return postDailyPoints;

    const metaByDate = new Map(metaSeries.map((point) => [point.date, point]));
    return postDailyPoints.map((point) => ({
      ...point,
      [metric]: metaByDate.get(point.date)?.[metric] || 0,
    }));
  }, [metric, payload.timeSeries, postDailyPoints]);
  const previousDailyPoints = useMemo(() => {
    if (metric !== "reach" && metric !== "follows") return previousPostDailyPoints;
    const metaSeries = payload.previousTimeSeries || [];
    return previousPostDailyPoints.map((point, index) => ({
      ...point,
      [metric]: metaSeries[index]?.[metric] || 0,
    }));
  }, [metric, payload.previousTimeSeries, previousPostDailyPoints]);
  const trendUsesAccountData = metric === "reach" || metric === "follows";
  const visiblePosts = useMemo(() => posts
    .filter((post) => filter === "all" || formatName(post).toLowerCase() === filter)
    .sort((left, right) => {
      if (sort === "engagementRate") return rate(right) - rate(left);
      return right[sort] - left[sort];
    }), [filter, posts, sort]);

  const account: Metrics = payload.account || { views: 0, reach: 0, accountsEngaged: 0, interactions: 0 };
  const previous: Metrics = payload.previousAccount || { views: 0, reach: 0, accountsEngaged: 0, interactions: 0 };
  const topReach = [...posts].sort((left, right) => right.reach - left.reach)[0];
  const topInteractions = [...posts].sort((left, right) => right.interactions - left.interactions)[0];
  const topRate = [...posts].sort((left, right) => rate(right) - rate(left))[0];
  const currentRate = account.reach ? (account.interactions / account.reach) * 100 : 0;
  const previousRate = previous.reach ? (previous.interactions / previous.reach) * 100 : 0;
  const comparisons = [
    ["Views", account.views, previous.views],
    ["Reach", account.reach, previous.reach],
    ["Interactions", account.interactions, previous.interactions],
    ["Accounts engaged", account.accountsEngaged || 0, previous.accountsEngaged || 0],
    ["Published posts", report?.totals.posts || 0, report?.previousTotals.posts || 0],
    ["Interaction rate", currentRate, previousRate],
  ] as const;
  const profileComparisons = [
    ["Profile views", account.profileViews || 0, previous.profileViews || 0],
    ["Website clicks", account.websiteClicks || 0, previous.websiteClicks || 0],
    ["Profile link taps", account.profileLinkTaps || 0, previous.profileLinkTaps || 0],
    ["Follows", account.follows || 0, previous.follows || 0],
    ["Unfollows", account.unfollows || 0, previous.unfollows || 0],
  ] as const;
  const kpis = comparisons.slice(0, 4);
  const formats = [...new Set(posts.map((post) => formatName(post).toLowerCase()))];
  const activeStories = payload.stories?.stories || [];

  return (
    <main className="ig-report" aria-busy={loading}>
      <div className="ig-report__paper">
        <header className="ig-report__header">
          <div className="ig-report__lockup">
            {payload.profile?.pictureUrl ? <img src={payload.profile.pictureUrl} alt="" /> : <span>IG</span>}
            <div>
              <p className="ig-report__eyebrow">Ahangama.com x Meta</p>
              <h1>Instagram <em>report</em></h1>
              <div className="ig-report__meta">
                <span><b>Period</b> {report ? `${dayjs(report.range.start).format("D MMM")} - ${dayjs(report.range.end).format("D MMM YYYY")}` : "Loading"}</span>
                <span><b>Account</b> @{payload.username || "ahangama.pass"}</span>
                <span><b>Followers</b> {integer(payload.profile?.followers)}</span>
              </div>
              <span className="ig-report__badge">Live Meta Graph API data</span>
            </div>
          </div>
          <div className="ig-report__segments" aria-label="Reporting period">
            {[7, 30, 90].map((value) => <button type="button" key={value} aria-pressed={days === value} onClick={() => { if (value === days) return; setLoading(true); setError(""); setDays(value); }}>{value} days</button>)}
          </div>
        </header>

        {loading ? <div className="ig-report__state">Loading live Instagram insights...</div> : null}
        {!loading && error ? <div className="ig-report__state ig-report__state--error"><strong>Instagram report unavailable</strong><span>{error}</span></div> : null}

        {!loading && !error && report ? <>
          <section className="ig-report__section" aria-labelledby="glance">
            <div className="ig-report__section-heading"><p className="ig-report__eyebrow">At a glance</p><h2 id="glance">What happened <em>this period</em></h2></div>
            <div className="ig-report__notes">
              <article><span>Audience</span><strong>{compact(account.reach)}</strong><p>accounts reached across Instagram.</p><b>{change(account.reach, previous.reach).label} vs prior period</b></article>
              <article><span>Top post</span><strong>{topReach ? compact(topReach.reach) : "-"}</strong><p>{topReach?.caption || "No posts in this period."}</p><b>highest reach</b></article>
              <article><span>Response</span><strong>{currentRate.toFixed(1)}%</strong><p>interactions as a share of reach.</p><b>{change(currentRate, previousRate).label} vs prior period</b></article>
              <article><span>Content</span><strong>{report.totals.posts}</strong><p>posts published in the selected window.</p><b>{report.formats[0]?.format || "No leading format"}</b></article>
            </div>
          </section>

          <section className="ig-report__section" aria-labelledby="numbers">
            <div className="ig-report__section-heading ig-report__section-heading--row"><div><p className="ig-report__eyebrow">The numbers</p><h2 id="numbers">Instagram <em>performance</em></h2></div><span>Account totals reported directly by Meta</span></div>
            <div className="ig-report__kpis">
              {kpis.map(([label, value, oldValue]) => { const delta = change(value, oldValue); return <article key={label}><span>{label}</span><strong>{compact(value)}</strong><b data-up={delta.value >= 0}>{delta.label} vs prior</b><small>Previous: {integer(oldValue)}</small></article>; })}
              <article><span>Published posts</span><strong>{report.totals.posts}</strong><b data-up={report.totals.posts >= report.previousTotals.posts}>{change(report.totals.posts, report.previousTotals.posts).label} vs prior</b><small>Previous: {report.previousTotals.posts}</small></article>
              <article><span>Followers</span><strong>{compact(payload.profile?.followers)}</strong><b data-up="true">Current audience</b><small>{integer(payload.profile?.mediaCount)} lifetime posts</small></article>
            </div>
          </section>

          <section className="ig-report__section" aria-labelledby="comparison">
            <div className="ig-report__section-heading ig-report__section-heading--row"><div><p className="ig-report__eyebrow">Period on period</p><h2 id="comparison">The shift, <em>side by side</em></h2></div><span>{dayjs(report.range.previousStart).format("D MMM")} - {dayjs(report.range.previousEnd).format("D MMM")} compared with this period</span></div>
            <div className="ig-report__comparison">
              {comparisons.map(([label, current, old]) => { const maximum = Math.max(current, old, 1); const delta = change(current, old); const percentageMetric = label === "Interaction rate"; return <article key={label}><div><span>{label}</span><strong data-up={delta.value >= 0}>{delta.label}</strong></div><p><b>Prior</b><i><em style={{ width: `${(old / maximum) * 100}%` }} /></i><span>{percentageMetric ? `${old.toFixed(1)}%` : compact(old)}</span></p><p><b>Now</b><i><em className="current" style={{ width: `${(current / maximum) * 100}%` }} /></i><span>{percentageMetric ? `${current.toFixed(1)}%` : compact(current)}</span></p></article>; })}
            </div>
          </section>

          <section className="ig-report__section" aria-labelledby="profile-actions">
            <div className="ig-report__section-heading ig-report__section-heading--row"><div><p className="ig-report__eyebrow">Profile activity</p><h2 id="profile-actions">Attention into <em>action</em></h2></div><span>Account actions reported directly by Meta for the selected period</span></div>
            <div className="ig-report__kpis ig-report__kpis--profile">
              {profileComparisons.map(([label, value, oldValue]) => { const delta = change(value, oldValue); return <article key={label}><span>{label}</span><strong>{compact(value)}</strong><b data-up={delta.value >= 0}>{delta.label} vs prior</b><small>Previous: {integer(oldValue)}</small></article>; })}
              <article><span>Net follows</span><strong>{integer((account.follows || 0) - (account.unfollows || 0))}</strong><b data-up={(account.follows || 0) >= (account.unfollows || 0)}>Follows minus unfollows</b><small>Meta account activity</small></article>
            </div>
          </section>

          <section className="ig-report__section" aria-labelledby="trend">
            <div className="ig-report__section-heading ig-report__section-heading--row"><div><p className="ig-report__eyebrow">Daily trend</p><h2 id="trend">When attention <em>moved</em></h2></div><div className="ig-report__segments">{(["views", "reach", "interactions", "follows"] as MetricKey[]).map((item) => <button type="button" key={item} aria-pressed={metric === item} onClick={() => setMetric(item)}>{item}</button>)}</div></div>
            <div className="ig-report__panel"><div className="ig-report__legend"><div><span><i />Current {metric}</span><span><i className="previous" />Prior period</span></div><small>{trendUsesAccountData ? "Daily account insights from Meta" : "Post insights grouped by publication date"}</small></div><TrendChart points={dailyPoints} previousPoints={previousDailyPoints} metric={metric} /></div>
          </section>

          <section className="ig-report__section" aria-labelledby="mix">
            <div className="ig-report__section-heading"><p className="ig-report__eyebrow">Content mix</p><h2 id="mix">Formats that <em>worked</em></h2></div>
            <div className="ig-report__mix-wrap"><table className="ig-report__mix"><thead><tr><th>Format</th><th>Posts</th><th>Views</th><th>Reach</th><th>Interactions</th><th>Avg. interactions</th></tr></thead><tbody>{report.formats.map((item) => <tr key={item.format}><td><strong>{item.format}</strong></td><td>{item.posts}</td><td>{integer(item.views)}</td><td>{integer(item.reach)}</td><td>{integer(item.interactions)}</td><td>{integer(item.interactions / Math.max(item.posts, 1))}</td></tr>)}</tbody></table></div>
          </section>

          <section className="ig-report__section" aria-labelledby="content">
            <div className="ig-report__section-heading ig-report__section-heading--row"><div><p className="ig-report__eyebrow">Post by post</p><h2 id="content">Every piece of <em>content</em></h2></div><div className="ig-report__segments"><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>{formats.map((item) => <button type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
            <div className="ig-report__table-wrap"><table><thead><tr><th>Post</th><th>Format</th>{(["reach", "views", "interactions", "saved", "engagementRate"] as SortKey[]).map((key) => <th key={key}><button type="button" aria-sort={sort === key ? "descending" : "none"} onClick={() => setSort(key)}>{key === "engagementRate" ? "Eng. rate" : key}</button></th>)}</tr></thead><tbody>{visiblePosts.map((post) => <tr key={post.id}><td><a href={post.permalink} target="_blank" rel="noreferrer">{post.imageUrl ? <img src={post.imageUrl} alt="" /> : null}<span><strong>{post.caption || "Post without a caption"}</strong><small>{dayjs(post.timestamp).format("D MMM YYYY")}</small></span></a></td><td><span className={`ig-report__chip ${formatName(post) === "Reel" ? "reel" : ""}`}>{formatName(post)}</span></td><td>{integer(post.reach)}</td><td>{integer(post.views)}</td><td>{integer(post.interactions)}</td><td>{integer(post.saved)}</td><td><div className="ig-report__rate"><span>{rate(post).toFixed(1)}%</span><i><b style={{ width: `${Math.min(rate(post) * 5, 100)}%` }} /></i></div></td></tr>)}</tbody></table>{!visiblePosts.length ? <p className="ig-report__empty">No posts match this format.</p> : null}</div>
          </section>

          <section className="ig-report__section" aria-labelledby="active-stories">
            <div className="ig-report__section-heading ig-report__section-heading--row"><div><p className="ig-report__eyebrow">Active Stories</p><h2 id="active-stories">What is live <em>right now</em></h2></div><span>Meta exposes active Stories, not a complete historical Story archive</span></div>
            {activeStories.length ? <div className="ig-report__story-grid">{activeStories.map((story) => <article key={story.id}>{story.imageUrl ? <img src={story.imageUrl} alt="" /> : <div className="ig-report__story-placeholder">Story</div>}<div><span>{dayjs(story.timestamp).format("D MMM, HH:mm")}</span><strong>{integer(story.views)} views</strong><dl><div><dt>Reach</dt><dd>{integer(story.reach)}</dd></div><div><dt>Interactions</dt><dd>{integer(story.interactions)}</dd></div><div><dt>Navigation</dt><dd>{integer(story.navigation)}</dd></div><div><dt>Replies</dt><dd>{integer(story.replies)}</dd></div></dl>{story.permalink ? <a href={story.permalink} target="_blank" rel="noreferrer">Open Story</a> : null}</div></article>)}</div> : <div className="ig-report__availability"><strong>{payload.stories?.available ? "No active Stories" : "Story insights unavailable"}</strong><span>{payload.stories?.reason || "Publish a Story to see its live views, reach, interactions, replies and navigation."}</span></div>}
          </section>

          <section className="ig-report__section" aria-labelledby="paid-attribution">
            <div className="ig-report__section-heading"><p className="ig-report__eyebrow">Paid and organic</p><h2 id="paid-attribution">Attribution <em>status</em></h2></div>
            <div className="ig-report__availability"><strong>{payload.paid?.available ? "Paid attribution connected" : "Paid attribution needs an ad account"}</strong><span>{payload.paid?.reason || "Connect a Meta ad account with ads_read access to separate promoted delivery from organic performance."}</span></div>
          </section>

          <section className="ig-report__section" aria-labelledby="standouts">
            <div className="ig-report__section-heading"><p className="ig-report__eyebrow">The standouts</p><h2 id="standouts">Three posts worth <em>noting</em></h2></div>
            <div className="ig-report__polaroids">{[[topReach, "Widest audience", topReach?.reach, "reach"], [topInteractions, "Most response", topInteractions?.interactions, "interactions"], [topRate, "Strongest rate", topRate ? rate(topRate) : 0, "engagement rate"]].map(([post, label, value, unit], index) => <article key={`${label}`}><div>{(post as InstagramPost | undefined)?.imageUrl ? <img src={(post as InstagramPost).imageUrl} alt="" /> : null}<strong>{index === 2 ? `${Number(value).toFixed(1)}%` : compact(Number(value))}</strong><span>{unit as string}</span></div><b>{label as string}</b><p>{(post as InstagramPost | undefined)?.caption || "No post data available."}</p></article>)}</div>
          </section>

          <section className="ig-report__section" aria-labelledby="learned">
            <div className="ig-report__section-heading"><p className="ig-report__eyebrow">What we learned</p><h2 id="learned">Signals to <em>carry forward</em></h2></div>
            <div className="ig-report__insights"><article><span>Audience signal</span><h3>{change(account.reach, previous.reach).value >= 0 ? "Reach is expanding" : "Reach needs rebuilding"}</h3><p>Reach is <b>{change(account.reach, previous.reach).label}</b> against the previous window, with {integer(account.reach)} accounts seeing content.</p></article><article><span>Content signal</span><h3>{report.formats[0]?.format || "More data needed"} leads the mix</h3><p>The leading format generated <b>{integer(report.formats[0]?.interactions || 0)} interactions</b> across {report.formats[0]?.posts || 0} posts.</p></article><article><span>Response signal</span><h3>{currentRate >= previousRate ? "Response improved" : "Attention outpaced action"}</h3><p>The account recorded a <b>{currentRate.toFixed(1)}% interaction rate by reach</b>, compared with {previousRate.toFixed(1)}% previously.</p></article></div>
          </section>

          <section className="ig-report__next"><p className="ig-report__eyebrow">Next period</p><h2>Keep the momentum <em>useful</em></h2><ol><li><span><b>Repeat the winning format.</b> Build the next content cycle around {report.formats[0]?.format || "the best-performing format once enough data is available"}.</span></li><li><span><b>Learn from the strongest post.</b> Reuse the topic and framing that gave “{topReach?.caption.slice(0, 62) || "the top post"}...” its reach.</span></li><li><span><b>Protect response quality.</b> Track shares and saves alongside reach so growth does not become passive exposure.</span></li></ol></section>

          <footer className="ig-report__footer"><div>Ready for the <em>next report?</em></div><span>Source: Meta Graph API. Updated {dayjs(payload.generatedAt).format("D MMM YYYY, HH:mm")}.</span></footer>
        </> : null}
      </div>
    </main>
  );
}