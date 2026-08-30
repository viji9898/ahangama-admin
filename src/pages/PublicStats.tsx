import { useEffect, useState } from "react";
import "./PublicStats.css";

type MetricItem = { label: string; value: number };
type StatsPayload = {
  generatedAt?: string;
  overview?: {
    activeVisitors?: number;
    pageViews?: number;
    clicks?: number;
    passesIssued?: number | null;
    liveVenues?: number | null;
  };
  website?: {
    available?: boolean;
    outboundClicks?: number;
    sessions?: number;
    topPages?: Array<{ path: string; title: string; views: number }>;
    trafficSources?: MetricItem[];
    countries?: MetricItem[];
  };
  qr?: {
    available?: boolean;
    scans?: number;
    clicks?: number;
    purchases?: number;
    surfaces?: MetricItem[];
    partners?: Array<{
      venue: string;
      scans: number;
      clicks: number;
      purchases: number;
      exposure: number;
    }>;
  };
  social?: {
    available?: boolean;
    reason?: string;
    username?: string;
    followers?: number;
    mediaCount?: number;
    views?: number;
    reach?: number;
    accountsEngaged?: number;
    interactions?: number;
    topContent?: Array<{
      id: string;
      caption: string;
      mediaType: string;
      permalink: string;
      imageUrl: string;
      likes: number;
      comments: number;
    }>;
  };
  facebook?: {
    available?: boolean;
    reason?: string;
    name?: string;
    link?: string;
    pageLikes?: number;
    views?: number;
    engagements?: number;
    pageViews?: number;
    followers?: number;
  };
  campaigns?: { available?: boolean; reason?: string };
};

const formatNumber = (value?: number | null) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);

const DISPLAY_LABELS: Record<string, string> = {
  ps: "Postcard Stands",
  plst: "Plastic Stands",
};

const titleCase = (value: string) =>
  DISPLAY_LABELS[value.toLowerCase()] ||
  value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function Bars({ items = [] }: { items?: MetricItem[] }) {
  const maximum = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="stats-bars">
      {items.map((item) => (
        <div className="stats-bar" key={item.label}>
          <div className="stats-bar__labels">
            <span>{titleCase(item.label)}</span>
            <strong>{formatNumber(item.value)}</strong>
          </div>
          <div className="stats-bar__track">
            <span
              style={{ width: `${Math.max((item.value / maximum) * 100, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyConnection({ label }: { label: string }) {
  return (
    <div className="stats-connection">
      <span className="stats-connection__mark" aria-hidden="true">
        +
      </span>
      <div>
        <strong>{label}</strong>
        <p>Connect this source to add live reporting.</p>
      </div>
    </div>
  );
}

function InstagramInsights({ social }: { social?: StatsPayload["social"] }) {
  if (!social?.available) {
    return (
      <EmptyConnection label={social?.reason || "Meta account not connected"} />
    );
  }

  return (
    <div className="stats-instagram">
      <div className="stats-instagram__metrics">
        {[
          ["Followers", social.followers],
          ["Views", social.views],
          ["Reach", social.reach],
          ["Engaged", social.accountsEngaged],
          ["Interactions", social.interactions],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <strong>{formatNumber(value as number | undefined)}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {social.topContent?.length ? (
        <div className="stats-instagram__content">
          <span>Top content</span>
          {social.topContent.map((item) => (
            <a
              href={item.permalink}
              key={item.id}
              target="_blank"
              rel="noreferrer"
            >
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
              <span>{item.caption}</span>
              <strong>{formatNumber(item.likes + item.comments)}</strong>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FacebookInsights({
  facebook,
}: {
  facebook?: StatsPayload["facebook"];
}) {
  if (!facebook?.available) {
    return (
      <EmptyConnection
        label={facebook?.reason || "Facebook Page not connected"}
      />
    );
  }

  return (
    <div className="stats-facebook__metrics">
      {[
        ["Followers", facebook.followers],
        ["Media views", facebook.views],
        ["Engagements", facebook.engagements],
        ["Page views", facebook.pageViews],
      ].map(([label, value]) => (
        <div key={String(label)}>
          <strong>{formatNumber(value as number | undefined)}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function PublicStats() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/.netlify/functions/api-public-stats?days=${days}&v=3`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response
          .json()
          .catch(() => ({}))) as StatsPayload & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(payload.error || "Unable to load stats");
        setData(payload);
      })
      .catch((loadError: Error) => {
        if (loadError.name !== "AbortError") setError(loadError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [days]);

  const overview = data?.overview;

  return (
    <main className="stats-page">
      <header className="stats-header">
        <a className="stats-brand" href="https://ahangama.com">
          AHANGAMA
        </a>
        <nav aria-label="Dashboard sections">
          <a href="#website">Website</a>
          <a href="#social">Social</a>
          <a href="#campaigns">Campaigns</a>
          <a href="#partners">Partners</a>
        </nav>
      </header>

      <section className="stats-hero">
        <div>
          <p className="stats-kicker">Community impact dashboard</p>
          <h1>
            Ahangama,
            <br />
            in numbers.
          </h1>
        </div>
        <div className="stats-hero__aside">
          <p>
            A live view of how people discover, explore and support Ahangama.
          </p>
          <div className="stats-period" aria-label="Reporting period">
            {[7, 30, 90].map((value) => (
              <button
                className={days === value ? "is-active" : ""}
                key={value}
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setDays(value);
                }}
                type="button"
              >
                {value}D
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? <div className="stats-alert">{error}</div> : null}
      <section
        className={`stats-overview ${loading ? "is-loading" : ""}`}
        aria-busy={loading}
      >
        {[
          ["Active visitors", overview?.activeVisitors],
          ["Page views", overview?.pageViews],
          ["Tracked clicks", overview?.clicks],
          ["Passes issued", overview?.passesIssued],
          ["Live venues", overview?.liveVenues],
        ].map(([label, value]) => (
          <article key={String(label)}>
            <strong>
              {loading
                ? "···"
                : formatNumber(value as number | null | undefined)}
            </strong>
            <span>{label}</span>
          </article>
        ))}
      </section>

      <section className="stats-section" id="website">
        <div className="stats-section__heading">
          <p>01 / Website</p>
          <h2>
            What people
            <br />
            are exploring
          </h2>
        </div>
        <div className="stats-grid stats-grid--website">
          <article className="stats-panel stats-panel--wide">
            <div className="stats-panel__title">
              <h3>Top pages</h3>
              <span>Views</span>
            </div>
            <div className="stats-list">
              {(data?.website?.topPages || []).map((page, index) => (
                <div className="stats-list__row" key={`${page.path}-${index}`}>
                  <span className="stats-list__index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{page.title}</strong>
                    <small>{page.path}</small>
                  </span>
                  <b>{formatNumber(page.views)}</b>
                </div>
              ))}
            </div>
          </article>
          <article className="stats-panel">
            <div className="stats-panel__title">
              <h3>Traffic sources</h3>
            </div>
            <Bars items={data?.website?.trafficSources} />
          </article>
          <article className="stats-panel">
            <div className="stats-panel__title">
              <h3>Top countries</h3>
            </div>
            <Bars items={data?.website?.countries} />
          </article>
        </div>
      </section>

      <section className="stats-section stats-section--dark" id="social">
        <div className="stats-section__heading">
          <p>02 / Social &amp; campaigns</p>
          <h2>
            Reach beyond
            <br />
            the coastline
          </h2>
        </div>
        <div className="stats-grid stats-grid--two">
          <article className="stats-panel stats-panel--dark stats-panel--social-wide">
            <div className="stats-panel__title">
              <h3>
                <a
                  href="https://www.instagram.com/ahangama.pass/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram{" "}
                  {data?.social?.username ? `@${data.social.username}` : ""}
                </a>
              </h3>
              <span>Reach · views · engagement</span>
            </div>
            <InstagramInsights social={data?.social} />
          </article>
          <article className="stats-panel stats-panel--dark">
            <div className="stats-panel__title">
              <h3>
                <a
                  href="https://www.facebook.com/p/Ahangamacom-61592748144834/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Facebook @ahangama.com
                </a>
              </h3>
              <span>Views · engagement · followers</span>
            </div>
            <FacebookInsights facebook={data?.facebook} />
          </article>
          <article className="stats-panel stats-panel--dark" id="campaigns">
            <div className="stats-panel__title">
              <h3>Paid campaigns</h3>
              <span>Spend · CTR · conversions</span>
            </div>
            <div className="stats-connection">
              <span className="stats-connection__mark" aria-hidden="true">
                +
              </span>
              <div>
                <strong>Coming Soon</strong>
                <p>Campaign reporting is being prepared.</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="stats-section" id="partners">
        <div className="stats-section__heading">
          <p>03 / QR, passes &amp; partners</p>
          <h2>
            From discovery
            <br />
            to action
          </h2>
        </div>
        <div className="stats-qr-summary">
          <article>
            <span>QR sessions</span>
            <strong>{formatNumber(data?.qr?.scans)}</strong>
          </article>
          <article>
            <span>Pass clicks</span>
            <strong>{formatNumber(data?.qr?.clicks)}</strong>
          </article>
          <article>
            <span>Purchases</span>
            <strong>{formatNumber(data?.qr?.purchases)}</strong>
          </article>
        </div>
        <div className="stats-grid stats-grid--partners">
          <article className="stats-panel">
            <div className="stats-panel__title">
              <h3>Scans by placement</h3>
            </div>
            <Bars items={data?.qr?.surfaces} />
          </article>
          <article className="stats-panel stats-panel--wide">
            <div className="stats-panel__title">
              <h3>Partner impact</h3>
              <span>Exposure · scans · clicks</span>
            </div>
            <div
              className="stats-table"
              role="table"
              aria-label="Partner impact"
            >
              <div className="stats-table__head" role="row">
                <span>Partner</span>
                <span>Exposure</span>
                <span>Scans</span>
                <span>Clicks</span>
              </div>
              {(data?.qr?.partners || []).map((partner) => (
                <div
                  className="stats-table__row"
                  role="row"
                  key={partner.venue}
                >
                  <strong>{titleCase(partner.venue)}</strong>
                  <span>{formatNumber(partner.exposure)}</span>
                  <span>{formatNumber(partner.scans)}</span>
                  <span>{formatNumber(partner.clicks)}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="stats-sources" id="data-sources">
        <div className="stats-sources__heading">
          <p>04 / Reporting</p>
          <h2>Data sources</h2>
          <span>Freshness</span>
        </div>
        <div className="stats-sources__list">
          {[
            ["Ahangama.com", "First-party events", "Live"],
            ["Google Analytics", "Realtime API", "<1 min"],
            ["Instagram", "Account & media insights", "15 min"],
            ["Facebook", "Page & ad insights", "15 min"],
            ["Google Ads", "Campaign reports", "Hourly"],
          ].map(([source, detail, freshness]) => (
            <article
              className={`stats-source ${(source === "Instagram" && data?.social?.available) || (source === "Facebook" && data?.facebook?.available) ? "is-connected" : ""}`}
              key={source}
            >
              <span className="stats-source__signal" aria-hidden="true" />
              <div>
                <h3>{source}</h3>
                <p>{detail}</p>
              </div>
              <strong>{freshness}</strong>
            </article>
          ))}
        </div>
      </section>

      <footer className="stats-footer">
        <span>AHANGAMA</span>
        <p>
          Updated{" "}
          {data?.generatedAt
            ? new Date(data.generatedAt).toLocaleString()
            : "when data loads"}
        </p>
      </footer>
    </main>
  );
}
