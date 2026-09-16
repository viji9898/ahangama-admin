import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "../components/ArticleInsights.css";
import "./GAInstagramEngagement.css";

const ENDPOINT = "/.netlify/functions/ga-instagram-engagement";

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
  mentions: string[];
  collaborators: string[];
  handles: string[];
};

type InstagramPayload = {
  ok?: boolean;
  error?: string;
  username?: string;
  posts?: InstagramPost[];
};

const integer = (value: number) =>
  new Intl.NumberFormat("en-US").format(Number(value || 0));

export default function GAInstagramEngagement() {
  const [payload, setPayload] = useState<InstagramPayload>({});
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("all");
  const [handle, setHandle] = useState("all");
  const [sort, setSort] = useState("newest");
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
        const next = (await response
          .json()
          .catch(() => ({}))) as InstagramPayload;

        if (!response.ok || next.ok === false) {
          throw new Error(
            next.error ||
              `Failed to load Instagram engagement (${response.status})`,
          );
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
  }, []);

  const posts = useMemo(() => payload.posts || [], [payload.posts]);
  const formats = useMemo(
    () =>
      Array.from(
        new Set(
          posts
            .map((post) => post.mediaProductType || post.mediaType)
            .filter(Boolean),
        ),
      ).sort(),
    [posts],
  );
  const handles = useMemo(
    () => Array.from(new Set(posts.flatMap((post) => post.handles))).sort(),
    [posts],
  );
  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matching = posts.filter((post) => {
      const postFormat = post.mediaProductType || post.mediaType;
      const matchesQuery =
        !normalizedQuery ||
        [post.caption, postFormat, ...post.handles]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesFormat = format === "all" || postFormat === format;
      const matchesHandle = handle === "all" || post.handles.includes(handle);
      return matchesQuery && matchesFormat && matchesHandle;
    });

    return matching.sort((left, right) => {
      if (sort === "interactions") {
        return right.interactions - left.interactions;
      }
      if (sort === "reach") return right.reach - left.reach;
      return right.timestamp.localeCompare(left.timestamp);
    });
  }, [format, handle, posts, query, sort]);
  const totals = useMemo(
    () =>
      posts.reduce(
        (result, post) => ({
          interactions: result.interactions + post.interactions,
          reach: result.reach + post.reach,
          views: result.views + post.views,
        }),
        { interactions: 0, reach: 0, views: 0 },
      ),
    [posts],
  );
  const kpis = [
    ["Posts", integer(posts.length), "All media returned by Instagram"],
    [
      "Interactions",
      integer(totals.interactions),
      "Likes, comments, shares and saves",
    ],
    ["Views", integer(totals.views), "Total post and reel views"],
    ["Reach", integer(totals.reach), "Accounts reached across all posts"],
    [
      "Mentioned handles",
      integer(handles.length),
      "Unique mentions and collaborators",
    ],
  ];

  return (
    <section
      className="article-insights instagram-insights"
      aria-busy={loading}
    >
      <div className="article-insights__heading">
        <div>
          <p>Instagram Engagement</p>
          <h3>How each post performs</h3>
        </div>
        <span>@{payload.username || "ahangama.pass"} · All posts</span>
      </div>

      <div className="article-insights__filters instagram-insights__filters">
        <label className="article-insights__filter instagram-insights__search">
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Post caption or Instagram handle"
          />
        </label>
        <label className="article-insights__filter">
          <span>Format</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option value="all">All formats</option>
            {formats.map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="article-insights__filter">
          <span>Instagram handle</span>
          <select
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
          >
            <option value="all">All handles</option>
            {handles.map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="article-insights__filter">
          <span>Sort by</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="interactions">Most interactions</option>
            <option value="reach">Highest reach</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="article-insights__state">
          <span className="stats-loader__icon" />
          Loading Instagram Engagement
        </div>
      ) : null}
      {!loading && error ? (
        <div className="article-insights__state article-insights__state--error">
          <strong>Instagram Engagement unavailable</strong>
          <span>{error}</span>
        </div>
      ) : null}
      {!loading && !error ? (
        <>
          <div className="article-insights__kpis">
            {kpis.map(([title, value, detail]) => (
              <article key={title}>
                <strong>{value}</strong>
                <span>{title}</span>
                <small>{detail}</small>
              </article>
            ))}
          </div>

          <div className="article-insights__panel">
            <div className="instagram-insights__panel-heading">
              <h4>All Instagram posts</h4>
              <span>{integer(filteredPosts.length)} posts</span>
            </div>
            <div
              className="article-insights__table instagram-insights__table"
              role="table"
            >
              <div className="article-insights__table-head" role="row">
                {[
                  "Post",
                  "Published",
                  "Format",
                  "Mentioned handles",
                  "Views",
                  "Reach",
                  "Likes",
                  "Comments",
                  "Shares",
                  "Saves",
                  "Interactions",
                ].map((heading) => (
                  <span key={heading}>{heading}</span>
                ))}
              </div>
              {!filteredPosts.length ? (
                <p className="article-insights__empty">
                  No matching Instagram posts.
                </p>
              ) : (
                filteredPosts.map((post) => (
                  <div
                    className="article-insights__table-row"
                    role="row"
                    key={post.id}
                  >
                    <div className="instagram-insights__post">
                      {post.imageUrl ? (
                        <img src={post.imageUrl} alt="" />
                      ) : null}
                      <div>
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View on Instagram
                        </a>
                        <p title={post.caption}>
                          {post.caption || "Post without a caption"}
                        </p>
                      </div>
                    </div>
                    <span>{dayjs(post.timestamp).format("D MMM YYYY")}</span>
                    <span>
                      {post.mediaProductType || post.mediaType || "Post"}
                    </span>
                    <div className="instagram-insights__handles">
                      {post.handles.length ? (
                        post.handles.map((item) => (
                          <span
                            key={item}
                            data-collaborator={post.collaborators.includes(
                              item,
                            )}
                            title={
                              post.collaborators.includes(item)
                                ? "Collaborator"
                                : "Caption mention"
                            }
                          >
                            {item}
                          </span>
                        ))
                      ) : (
                        <em>None</em>
                      )}
                    </div>
                    <span>{integer(post.views)}</span>
                    <span>{integer(post.reach)}</span>
                    <span>{integer(post.likes)}</span>
                    <span>{integer(post.comments)}</span>
                    <span>{integer(post.shares)}</span>
                    <span>{integer(post.saved)}</span>
                    <strong>{integer(post.interactions)}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
