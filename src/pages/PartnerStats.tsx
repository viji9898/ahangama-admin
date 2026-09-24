import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./PublicStats.css";

type MetricItem = { label: string; value: number };
type PartnerStatsPayload = {
  generatedAt?: string;
  snapshotDate?: string;
  snapshotAt?: string;
  partner?: {
    id: string;
    slug: string;
    name: string;
    instagram: string;
    instagramUrl: string;
    image: string;
    mapUrl: string;
  };
  guide?: {
    available?: boolean;
    error?: string;
    comparison?: {
      actionsBehindLeader: number;
      actionShare: number;
    };
    venue?: {
      impressions: number;
      usersExposed: number;
      engagements: number;
      users: number;
      linkTypes: MetricItem[];
    };
  };
  articles?: {
    available?: boolean;
    error?: string;
    articles?: Array<{
      contentId: string;
      title: string;
      url: string;
      pageViews: number;
      visitors: number;
      engagedVisits: number;
      engagedReads: number;
      completions: number;
      placeClicks: number;
    }>;
  };
  social?: {
    available?: boolean;
    error?: string;
    username?: string;
    views?: number;
    reach?: number;
    interactions?: number;
    posts?: Array<{
      id: string;
      caption: string;
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
    }>;
  };
};

const number = (value?: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact" }).format(value || 0);

const percentage = (value: number, total: number, decimals = 0) =>
  total > 0 ? ((value / total) * 100).toFixed(decimals) : "0";

const currency = (value: number, decimals = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(value) ? value : 0);

const label = (value: string) =>
  value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

function MetricTip({ id, text }: { id: string; text: string }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <span
      className="stats-metric-tip"
      data-open={focused || hovered}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        className="stats-metric-tip__trigger"
        type="button"
        aria-label="Explain this metric"
        aria-describedby={id}
        aria-expanded={focused || hovered}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        i
      </button>
      <span className="stats-metric-tip__content" id={id} role="tooltip">
        {text}
      </span>
    </span>
  );
}

function Loading() {
  return (
    <div className="partner-stats__state" role="status">
      <span className="stats-loader__icon" aria-hidden="true" />
      Loading partner performance
    </div>
  );
}

export default function PartnerStats() {
  const { partnerSlug = "" } = useParams();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<PartnerStatsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(
      `/.netlify/functions/api-public-stats?partner=${encodeURIComponent(partnerSlug)}&days=${days}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as
          PartnerStatsPayload & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to load stats");
        setData(payload);
      })
      .catch((loadError: Error) => {
        if (loadError.name !== "AbortError") setError(loadError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [days, partnerSlug]);

  const partner = data?.partner;
  const partnerName = partner?.name || label(partnerSlug);
  const partnerInstagram = partner?.instagram || data?.social?.username || "";
  const partnerHandle = partnerInstagram ? `@${partnerInstagram}` : "the partner account";
  const isPetals = partner?.id === "patels-ahangama";
  const guideAvailable = data?.guide?.available === true;
  const articlesAvailable = data?.articles?.available === true;
  const socialAvailable = data?.social?.available === true;
  const combinedAvailable = guideAvailable && articlesAvailable && socialAvailable;
  const venue = data?.guide?.venue;
  const articles = data?.articles?.articles || [];
  const posts = data?.social?.posts || [];
  const articleTotals = articles.reduce(
    (totals, article) => ({
      pageViews: totals.pageViews + article.pageViews,
      visitors: totals.visitors + article.visitors,
      engagedReads: totals.engagedReads + article.engagedReads,
      completions: totals.completions + article.completions,
      placeClicks: totals.placeClicks + article.placeClicks,
    }),
    {
      pageViews: 0,
      visitors: 0,
      engagedReads: 0,
      completions: 0,
      placeClicks: 0,
    },
  );
  const totalVisibility =
    Number(venue?.impressions || 0) +
    articleTotals.pageViews +
    Number(data?.social?.views || 0);
  const combinedAudience =
    Number(venue?.usersExposed || 0) +
    articleTotals.visitors +
    Number(data?.social?.reach || 0);
  const recordedInteractions =
    Number(venue?.engagements || 0) +
    articleTotals.engagedReads +
    articleTotals.placeClicks +
    Number(data?.social?.interactions || 0);
  const campaignStart = Date.UTC(2026, 7, 21);
  const campaignEnd = Date.UTC(2027, 7, 20);
  const generatedAt = data?.generatedAt ? Date.parse(data.generatedAt) : Date.now();
  const campaignElapsed = Math.min(Math.max(generatedAt - campaignStart, 0), campaignEnd - campaignStart);
  const campaignProgress = Math.round((campaignElapsed / (campaignEnd - campaignStart)) * 100);
  const monthsRemaining = Math.max(0, Math.round((campaignEnd - generatedAt) / (30.44 * 24 * 60 * 60 * 1000)));
  const instagramVisibilityShare = percentage(Number(data?.social?.views || 0), totalVisibility);
  const instagramInteractionRate = percentage(
    Number(data?.social?.interactions || 0),
    Number(data?.social?.reach || 0),
    1,
  );
  const guideActionRate = percentage(
    Number(venue?.engagements || 0),
    Number(venue?.usersExposed || 0),
    1,
  );
  const campaignInvestment = 150;
  const blendedCpm = campaignInvestment / Math.max(totalVisibility, 1) * 1000;
  const costPerAudience = campaignInvestment / Math.max(combinedAudience, 1);
  const costPerInteraction = campaignInvestment / Math.max(recordedInteractions, 1);
  const guideOutboundRate = percentage(
    Number(venue?.engagements || 0),
    Number(venue?.impressions || 0),
    1,
  );

  return (
    <main className="stats-page partner-stats">
      <header className="stats-header">
        <a className="stats-brand" href="https://ahangama.com">AHANGAMA</a>
        <nav aria-label="Partner report sections">
          <a href="#performance">Overview</a>
          <a href="#articles">Articles</a>
          <a href="#instagram">Instagram</a>
        </nav>
      </header>

      <section className="partner-stats__hero">
        {partner?.image ? <img src={partner.image} alt="" /> : null}
        <div className="partner-stats__hero-shade" />
        <div className="partner-stats__hero-content">
          <p className="stats-kicker">Partner performance</p>
          <h1>{partnerName},<br />in numbers.</h1>
          <div className="stats-period" aria-label="Reporting period">
            {[7, 30, 90, 180, 365].map((value) => (
              <button
                className={days === value ? "is-active" : ""}
                key={value}
                type="button"
                onClick={() => setDays(value)}
              >
                {value}D
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? <Loading /> : null}
      {!loading && error ? <div className="stats-alert">{error}</div> : null}
      {!loading && !error ? (
        <section className="stats-section partner-stats__section" id="performance">
          {isPetals ? (
            <aside className="partner-stats__promotion-note">
              <span>Annual promotion</span>
              <p>Promotion period: 21 August 2026 to 20 August 2027</p>
            </aside>
          ) : null}
          <div className="stats-section__heading">
            <p>01 / Combined performance</p>
            <h2>The complete<br />{partnerName} picture</h2>
          </div>
          <div className="partner-stats__overview">
            {[
              [
                "Total visibility",
                totalVisibility,
                "Online Guide impressions, article page views and Instagram post views added together. Repeat views are included.",
              ],
              [
                "Combined audience",
                combinedAudience,
                "Online Guide users exposed, article visitors and Instagram reach added together. People may appear in more than one source.",
              ],
              [
                "Recorded interactions",
                recordedInteractions,
                "Online Guide outbound actions, article engaged reads and place clicks, and Instagram interactions added together.",
              ],
            ].map(([title, value, tip], index) => (
              <article key={String(title)}>
                <strong>{combinedAvailable ? number(value as number) : "—"}</strong>
                <span className="partner-stats__metric-label">
                  {title}
                  <MetricTip id={`overview-metric-${index}`} text={String(tip)} />
                </span>
              </article>
            ))}
          </div>
          <p className="partner-stats__overview-note">
            {combinedAvailable
              ? "Cross-channel totals add source-level results and are not deduplicated between the website, article and Instagram."
              : "Combined totals are unavailable because one or more data sources failed when this snapshot was collected."}
          </p>

          <div className="partner-stats__sources">
            <div className="partner-stats__source">
              <div className="partner-stats__source-heading">
                <p>Source 01</p>
                <h3>Online guide</h3>
              </div>
              <div className="partner-stats__source-metrics">
                <span>
                  <strong>{guideAvailable ? number(venue?.impressions) : "—"}</strong>
                  <span className="partner-stats__metric-label">
                    Tracked impressions
                    <MetricTip id="partner-guide-impressions" text={`Times the ${partnerName} card entered a visitor's view in the Online Guide. Repeat views count. Tracking began 7 September 2026.`} />
                  </span>
                </span>
                <span>
                  <strong>{guideAvailable ? number(venue?.usersExposed) : "—"}</strong>
                  <span className="partner-stats__metric-label">
                    Users exposed
                    <MetricTip id="partner-guide-exposed" text={`Unique GA4 users who generated at least one tracked ${partnerName} card impression in the selected period.`} />
                  </span>
                </span>
                <span>
                  <strong>{guideAvailable ? number(venue?.engagements) : "—"}</strong>
                  <span className="partner-stats__metric-label">
                    Outbound actions
                    <MetricTip id="partner-guide-actions" text={`Clicks from the ${partnerName} guide listing to destinations such as Instagram, Google Maps or a website.`} />
                  </span>
                </span>
                <span>
                  <strong>{guideAvailable
                    ? (Number(venue?.engagements || 0) / Math.max(Number(venue?.users || 0), 1)).toFixed(1)
                    : "—"}</strong>
                  <span className="partner-stats__metric-label">
                    Actions per visitor
                    <MetricTip id="partner-guide-actions-per-visitor" text="Outbound actions divided by unique visitors who took an action. One visitor can take several actions." />
                  </span>
                </span>
              </div>
              <p className="partner-stats__source-note">
                {guideAvailable
                  ? "In-depth Online Guide tracking since 7 September 2026."
                  : "Online Guide data was unavailable when this snapshot was collected."}
              </p>
            </div>
            <div className="partner-stats__source">
              <div className="partner-stats__source-heading">
                <p>Source 02</p>
                <h3>{partnerName} articles</h3>
              </div>
              <div className="partner-stats__source-metrics">
                <span>
                  <strong>{articlesAvailable ? number(articleTotals.pageViews) : "—"}</strong>
                  <span className="partner-stats__metric-label">
                    Views
                    <MetricTip id="partner-article-views" text={`Total page views for ${partnerName} articles. Repeat views by the same visitor are included.`} />
                  </span>
                </span>
                <span>
                  <strong>{articlesAvailable ? number(articleTotals.visitors) : "—"}</strong>
                  <span className="partner-stats__metric-label">
                    Visitors
                    <MetricTip id="partner-article-visitors" text={`Unique GA4 users who viewed a ${partnerName} article during the selected period.`} />
                  </span>
                </span>
                <span>
                  <strong>{articlesAvailable ? number(articleTotals.engagedReads) : "—"}</strong>
                  <span className="partner-stats__metric-label">
                    Engaged reads
                    <MetricTip id="partner-article-engaged" text="Reads that recorded at least 15 active seconds and 25% scroll depth. This event has been tracked since 11 September 2026." />
                  </span>
                </span>
                <span>
                  <strong>{articlesAvailable ? number(articleTotals.placeClicks) : "—"}</strong>
                  <span className="partner-stats__metric-label">
                    Place clicks
                    <MetricTip id="partner-article-clicks" text={`Clicks from a ${partnerName} article to a featured place or other tracked outbound destination.`} />
                  </span>
                </span>
              </div>
              <p className="partner-stats__source-note">
                {articlesAvailable
                  ? "In-depth article events tracked since 11 September 2026."
                  : "Article data was unavailable when this snapshot was collected."}
              </p>
            </div>
            <div className="partner-stats__source partner-stats__source--dark">
              <div className="partner-stats__source-heading">
                <p>Source 03</p>
                <h3>Instagram</h3>
              </div>
              <div className="partner-stats__source-metrics">
                <span>
                  <strong>{socialAvailable ? number(data?.social?.views) : "—"}</strong>
                  <span className="partner-stats__metric-label">
                    Views
                    <MetricTip id="partner-instagram-views" text="Times attributed Instagram posts were viewed. Repeat views by the same account may be included." />
                  </span>
                </span>
                <span>
                  <strong>{socialAvailable ? number(data?.social?.reach) : "—"}</strong>
                  <span className="partner-stats__metric-label">
                    Reach
                    <MetricTip id="partner-instagram-reach" text="Instagram accounts that saw attributed posts, as reported by Meta." />
                  </span>
                </span>
                <span>
                  <strong>{socialAvailable ? number(data?.social?.interactions) : "—"}</strong>
                  <span className="partner-stats__metric-label">
                    Interactions
                    <MetricTip id="partner-instagram-interactions" text="Total interactions reported by Meta, including likes, comments, shares and saves." />
                  </span>
                </span>
                <span>
                  <strong>{socialAvailable ? number(posts.length) : "—"}</strong>
                  <span className="partner-stats__metric-label">
                    Attributed posts
                    <MetricTip id="partner-instagram-posts" text={`Ahangama Instagram posts that mention or collaborate with ${partnerHandle} in the selected period.`} />
                  </span>
                </span>
              </div>
            </div>
          </div>

          <aside className="partner-stats__analysis" id="analysis" aria-labelledby="partner-analysis-title" hidden>
            <div className="partner-stats__analysis-heading">
              <p>AI-assisted campaign analysis</p>
              <h2 id="partner-analysis-title">An encouraging opening chapter.</h2>
              <span>
                The annual promotion is approximately {campaignProgress}% complete, with around {monthsRemaining} months still available to build frequency, recognition and intent.
              </span>
            </div>
            <p className="partner-stats__analysis-intro">
              These results should be read as an early baseline, not a final verdict. The first signals are positive: {partnerName} is earning attention across social, editorial and the Online Guide, while the longer campaign runway gives us time to repeat what works and strengthen conversion.
            </p>
            <div className="partner-stats__efficiency-heading">
              <p>Investment efficiency</p>
              <span>Full annual fee measured against this {days}-day reporting view</span>
            </div>
            <div className="partner-stats__efficiency">
              <article>
                <strong>{currency(campaignInvestment, 0)}</strong>
                <span className="partner-stats__metric-label">
                  Annual investment
                  <MetricTip id="partner-investment" text={`The total fee paid for the annual ${partnerName} promotion from 21 August 2026 to 20 August 2027.`} />
                </span>
              </article>
              <article>
                <strong>{currency(blendedCpm, 0)}</strong>
                <span className="partner-stats__metric-label">
                  Blended eCPM
                  <MetricTip id="partner-ecpm" text="Annual investment divided by total tracked visibility, multiplied by 1,000. It combines unlike channels, so it is a directional efficiency measure rather than a paid-media CPM." />
                </span>
              </article>
              <article>
                <strong>{currency(costPerAudience)}</strong>
                <span className="partner-stats__metric-label">
                  Cost per audience
                  <MetricTip id="partner-cost-audience" text="Annual investment divided by combined audience. Audience is not deduplicated between Instagram, articles and the Online Guide." />
                </span>
              </article>
              <article>
                <strong>{currency(costPerInteraction)}</strong>
                <span className="partner-stats__metric-label">
                  Cost per interaction
                  <MetricTip id="partner-cost-interaction" text="Annual investment divided by recorded interactions across Instagram, articles and the Online Guide." />
                </span>
              </article>
            </div>
            <p className="partner-stats__efficiency-note">
              <strong>Early value assessment: promising, not yet proven as revenue ROI.</strong> These are standard efficiency formulas, but this is not a media-only buy: the fee also covers content production, editorial distribution and year-long placement. Unit costs should improve as the article and guide continue accumulating attention without another campaign fee. Booking or revenue attribution would be required to calculate financial return on investment.
            </p>
            <div className="partner-stats__analysis-signals">
              <article>
                <span>Strongest early signal</span>
                <h3>Instagram is driving discovery</h3>
                <p>
                  Instagram contributes {instagramVisibilityShare}% of tracked visibility in this {days}-day view. {number(data?.social?.reach)} accounts were reached and {number(data?.social?.interactions)} interactions were recorded, producing a {instagramInteractionRate}% engagement rate by reach. That is a promising response, though {posts.length === 1 ? "one attributed post is too early to establish a trend" : `${posts.length} attributed posts still represent an early sample`}.
                </p>
              </article>
              <article>
                <span>Compounding value</span>
                <h3>The article extends the story</h3>
                <p>
                  {partnerName} editorial content has generated {number(articleTotals.pageViews)} views from {number(articleTotals.visitors)} visitors. Unlike a social post, this story remains searchable and shareable throughout the year. In-depth reading events are too new to judge content quality reliably yet.
                </p>
              </article>
              <article>
                <span>Early intent</span>
                <h3>The guide is prompting action</h3>
                <p>
                  The {partnerName} listing reached {number(venue?.usersExposed)} tracked users and generated {number(venue?.engagements)} outbound {Number(venue?.engagements || 0) === 1 ? "action" : "actions"}. That is a {guideOutboundRate}% outbound rate against tracked impressions and a {guideActionRate}% action-to-exposure rate. The volume is still small, but {Number(venue?.engagements || 0) === 1 ? "this action indicates" : "these actions indicate"} movement from awareness toward consideration.
                </p>
              </article>
            </div>
            <div className="partner-stats__analysis-next">
              <div>
                <p>Recommended next phase</p>
                <h3>Build evidence through repetition</h3>
              </div>
              <ol>
                <li><strong>Maintain visibility.</strong> Publish consistently enough to learn which {partnerName} stories and formats generate repeat reach.</li>
                <li><strong>Connect attention to action.</strong> Keep clear Instagram, map and booking pathways across every {partnerName} touchpoint.</li>
                <li><strong>Review by quarter.</strong> Use the first 90 days as the baseline, then compare reach, article depth and outbound intent without over-projecting early results.</li>
              </ol>
            </div>
          </aside>

          <div className="partner-stats__detail">
            <div className="partner-stats__actions">
              <div className="partner-stats__actions-heading">
                <h3>Recorded intent</h3>
                <span>{guideAvailable ? `${number(venue?.engagements)} total actions` : "Data unavailable"}</span>
              </div>
              {!guideAvailable ? (
                <p>Online Guide data was unavailable when this snapshot was collected.</p>
              ) : venue?.linkTypes.length ? venue.linkTypes.map((item) => (
                <div key={item.label}>
                  <span>{label(item.label)}</span>
                  <strong>{number(item.value)}</strong>
                </div>
              )) : <p>No outbound actions were recorded in this period.</p>}
            </div>
          </div>

          <div className="partner-stats__detail" id="articles">
            <div className="partner-stats__detail-heading">
              <p>Article performance</p>
              <h3>All {partnerName} articles</h3>
            </div>
            {!articlesAvailable ? (
              <p className="partner-stats__empty">Article data was unavailable when this snapshot was collected.</p>
            ) : articles.length ? (
              <div className="partner-stats__articles">
                {articles.map((article) => (
                  <a href={article.url} target="_blank" rel="noreferrer" key={article.contentId}>
                    <h3>{article.title}</h3>
                    <div>
                      <span><strong>{number(article.pageViews)}</strong> Views</span>
                      <span><strong>{number(article.visitors)}</strong> Visitors</span>
                      <span>
                        <strong>{number(article.engagedReads)}</strong>
                        <span className="partner-stats__metric-label">
                          Engaged reads
                          <MetricTip id={`article-engaged-${article.contentId}`} text="Reads that recorded at least 15 active seconds and 25% scroll depth. Tracking began 11 September 2026." />
                        </span>
                      </span>
                      <span>
                        <strong>{number(article.completions)}</strong>
                        <span className="partner-stats__metric-label">
                          Completions
                          <MetricTip id={`article-complete-${article.contentId}`} text="Reads that recorded at least 30 active seconds and 90% scroll depth." />
                        </span>
                      </span>
                      <span><strong>{number(article.placeClicks)}</strong> Place clicks</span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="partner-stats__empty">No {partnerName}-related article activity was recorded in this period.</p>
            )}
          </div>

          <div className="partner-stats__detail partner-stats__detail--social" id="instagram">
            <div className="partner-stats__detail-heading">
              <p>Instagram performance</p>
              <h3>Posts mentioning {partnerHandle}</h3>
            </div>
            {!socialAvailable ? (
              <p className="partner-stats__empty partner-stats__empty--dark">Instagram data was unavailable when this snapshot was collected.</p>
            ) : posts.length ? (
              <div className="partner-stats__posts">
                {posts.map((post) => (
                  <a href={post.permalink} target="_blank" rel="noreferrer" key={post.id}>
                    {post.imageUrl ? <img src={post.imageUrl} alt="" /> : null}
                    <div>
                      <h3>{post.caption}</h3>
                      <p>{new Date(post.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                      <span>{number(post.views)} views</span>
                      <span>{number(post.reach)} reach</span>
                      <span>{number(post.interactions)} interactions</span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="partner-stats__empty partner-stats__empty--dark">No {partnerHandle} mentions or collaborations were recorded in this period.</p>
            )}
            {partner?.instagramUrl ? (
              <a className="partner-stats__instagram-link" href={partner.instagramUrl} target="_blank" rel="noreferrer">
                View @{partner.instagram} on Instagram
              </a>
            ) : null}
          </div>

          <aside className="partner-stats__methodology" aria-labelledby="partner-methodology-title">
            <div className="partner-stats__methodology-heading">
              <p>Measurement &amp; sources</p>
              <h2 id="partner-methodology-title">How this report is measured</h2>
              <span>Direct platform data, scoped to {partnerName} and the selected reporting period.</span>
            </div>
            <div className="partner-stats__methodology-grid">
              <article>
                <span>01</span>
                <h3>Website &amp; articles</h3>
                <p>
                  Google Analytics 4 measures guide exposure, visitors, page views and tracked actions on ahangama.com. Article depth events record active reading time and scroll milestones.
                </p>
              </article>
              <article>
                <span>02</span>
                <h3>Instagram</h3>
                <p>
                  Views, reach and interactions come from the Meta Graph API. Only Ahangama posts that mention or collaborate with {partnerHandle} are included.
                </p>
              </article>
              <article>
                <span>03</span>
                <h3>Attribution</h3>
                <p>
                  {partnerName} is identified through Ahangama's venues API. Guide events are matched by venue identity, articles by explicit content mappings, and Instagram by the exact account handle.
                </p>
              </article>
              <article>
                <span>04</span>
                <h3>Reading the totals</h3>
                <p>
                  Cross-channel totals combine each platform's reported metrics and are not deduplicated between sources. Guide tracking began 7 September 2026; in-depth article tracking began 11 September 2026.
                </p>
              </article>
            </div>
          </aside>
        </section>
      ) : null}

      <footer className="stats-footer">
        <span>{partner?.name?.toUpperCase() || "AHANGAMA"}</span>
        <p>
          Snapshot taken {data?.snapshotAt
            ? new Date(data.snapshotAt).toLocaleString()
            : "when data loads"}
        </p>
      </footer>
    </main>
  );
}