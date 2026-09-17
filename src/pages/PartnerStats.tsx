import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./PublicStats.css";

type MetricItem = { label: string; value: number };
type PartnerStatsPayload = {
  generatedAt?: string;
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

const label = (value: string) =>
  value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

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
          <h1>{partner?.name || label(partnerSlug)},<br />in numbers.</h1>
          <div className="stats-period" aria-label="Reporting period">
            {[7, 30, 90].map((value) => (
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
          <div className="stats-section__heading">
            <p>01 / Combined performance</p>
            <h2>The complete<br />Petals picture</h2>
          </div>
          <div className="partner-stats__overview">
            {[
              ["Total visibility", totalVisibility],
              ["Combined audience", combinedAudience],
              ["Recorded interactions", recordedInteractions],
            ].map(([title, value]) => (
              <article key={String(title)}>
                <strong>{number(value as number)}</strong>
                <span>{title}</span>
              </article>
            ))}
          </div>
          <p className="partner-stats__overview-note">
            Cross-channel totals add source-level results and are not deduplicated
            between the website, article and Instagram.
          </p>

          <div className="partner-stats__sources">
            <div className="partner-stats__source">
              <div className="partner-stats__source-heading">
                <p>Source 01</p>
                <h3>Online guide</h3>
              </div>
              <div className="partner-stats__source-metrics">
                <span><strong>{number(venue?.impressions)}</strong> Tracked impressions</span>
                <span><strong>{number(venue?.usersExposed)}</strong> Users exposed</span>
                <span><strong>{number(venue?.engagements)}</strong> Outbound actions</span>
                <span>
                  <strong>{(Number(venue?.engagements || 0) / Math.max(Number(venue?.users || 0), 1)).toFixed(1)}</strong>
                  Actions per visitor
                </span>
              </div>
              <p className="partner-stats__source-note">
                In-depth Online Guide tracking since 7 September 2026.
              </p>
            </div>
            <div className="partner-stats__source">
              <div className="partner-stats__source-heading">
                <p>Source 02</p>
                <h3>Petals article</h3>
              </div>
              <div className="partner-stats__source-metrics">
                <span><strong>{number(articleTotals.pageViews)}</strong> Views</span>
                <span><strong>{number(articleTotals.visitors)}</strong> Visitors</span>
                <span><strong>{number(articleTotals.engagedReads)}</strong> Engaged reads</span>
                <span><strong>{number(articleTotals.placeClicks)}</strong> Place clicks</span>
              </div>
              <p className="partner-stats__source-note">
                In-depth article events tracked since 11 September 2026.
              </p>
            </div>
            <div className="partner-stats__source partner-stats__source--dark">
              <div className="partner-stats__source-heading">
                <p>Source 03</p>
                <h3>Instagram</h3>
              </div>
              <div className="partner-stats__source-metrics">
                <span><strong>{number(data?.social?.views)}</strong> Views</span>
                <span><strong>{number(data?.social?.reach)}</strong> Reach</span>
                <span><strong>{number(data?.social?.interactions)}</strong> Interactions</span>
                <span><strong>{number(posts.length)}</strong> Attributed posts</span>
              </div>
            </div>
          </div>

          <div className="partner-stats__detail">
            <div className="partner-stats__actions">
              <div className="partner-stats__actions-heading">
                <h3>Recorded intent</h3>
                <span>{number(venue?.engagements)} total actions</span>
              </div>
              {venue?.linkTypes.length ? venue.linkTypes.map((item) => (
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
              <h3>Petals Ahangama: A Dream Rooted In Legacy</h3>
            </div>
            {articles.length ? (
              <div className="partner-stats__articles">
                {articles.map((article) => (
                  <a href={article.url} target="_blank" rel="noreferrer" key={article.contentId}>
                    <h3>{article.title}</h3>
                    <div>
                      <span><strong>{number(article.pageViews)}</strong> Views</span>
                      <span><strong>{number(article.visitors)}</strong> Visitors</span>
                      <span><strong>{number(article.engagedReads)}</strong> Engaged reads</span>
                      <span><strong>{number(article.completions)}</strong> Completions</span>
                      <span><strong>{number(article.placeClicks)}</strong> Place clicks</span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="partner-stats__empty">No Petals-related article activity was recorded in this period.</p>
            )}
          </div>

          <div className="partner-stats__detail partner-stats__detail--social" id="instagram">
            <div className="partner-stats__detail-heading">
              <p>Instagram performance</p>
              <h3>Posts mentioning @petals.ahangama</h3>
            </div>
            {posts.length ? (
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
              <p className="partner-stats__empty partner-stats__empty--dark">No @petals.ahangama mentions or collaborations were recorded in this period.</p>
            )}
            {partner?.instagramUrl ? (
              <a className="partner-stats__instagram-link" href={partner.instagramUrl} target="_blank" rel="noreferrer">
                View @{partner.instagram} on Instagram
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <footer className="stats-footer">
        <span>{partner?.name?.toUpperCase() || "AHANGAMA"}</span>
        <p>Updated {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "when data loads"}</p>
      </footer>
    </main>
  );
}