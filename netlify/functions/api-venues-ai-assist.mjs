import { requireAdmin } from "./_lib/auth.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => normalizeText(item)).filter(Boolean)),
  );
}

function getOffersArray(value) {
  if (Array.isArray(value)) {
    return normalizeStringArray(value);
  }
  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(/\r?\n|,/)
          .map((item) => normalizeText(item))
          .filter(Boolean),
      ),
    );
  }
  return [];
}

function buildVenuePayload(venue = {}) {
  return {
    name: normalizeText(venue.name),
    category: normalizeText(venue.category),
    categories: normalizeStringArray(venue.categories),
    area: normalizeText(venue.area),
    destinationSlug: normalizeText(venue.destinationSlug),
    excerpt: normalizeText(venue.excerpt),
    description: normalizeText(venue.description),
    bestFor: normalizeStringArray(venue.bestFor),
    tags: normalizeStringArray(venue.tags),
    cardPerk: normalizeText(venue.cardPerk),
    offers: getOffersArray(venue.offers),
    howToClaim: normalizeText(venue.howToClaim),
    restrictions: normalizeText(venue.restrictions),
    price: normalizeText(venue.price),
    hours: normalizeText(venue.hours),
    stars:
      venue.stars === null || venue.stars === undefined
        ? null
        : Number(venue.stars),
    reviews:
      venue.reviews === null || venue.reviews === undefined
        ? null
        : Number(venue.reviews),
  };
}

function buildVenueSearchPayload(query) {
  return {
    query: normalizeText(query),
  };
}

function collectOutputText(content) {
  if (!Array.isArray(content)) return "";

  return content
    .filter((item) => item?.type === "output_text" && item?.text)
    .map((item) => item.text)
    .join("\n")
    .trim();
}

function parseJsonResponse(data) {
  const outputItems = Array.isArray(data?.output) ? data.output : [];
  const messageText = outputItems
    .filter((item) => item?.type === "message")
    .map((item) => collectOutputText(item?.content))
    .find(Boolean);

  const text = messageText || normalizeText(data?.output_text);

  if (!text) {
    throw new Error("OpenAI returned an empty response");
  }

  return JSON.parse(text);
}

async function generateVenueCopySuggestions(venue) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("Missing env var: OPENAI_API_KEY");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You write concise, specific venue copy for an admin curation tool. Keep claims grounded in the provided venue data only. Do not invent amenities, location facts, or promotional promises. Return strict JSON only.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Create editorial copy suggestions for this venue record:\n${JSON.stringify(venue, null, 2)}\n\nReturn JSON with exactly these keys: excerpt, description, bestFor, tags.\nRules:\n- excerpt: 1 sentence, max 160 characters.\n- description: 2 short paragraphs, under 650 characters total.\n- bestFor: array of 3 to 6 short phrases.\n- tags: array of 4 to 8 concise tags.\n- Preserve the venue's actual category and offer context.\n- Avoid hype, superlatives, and anything not supported by the input.`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "venue_copy_suggestions",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["excerpt", "description", "bestFor", "tags"],
            properties: {
              excerpt: { type: "string" },
              description: { type: "string" },
              bestFor: {
                type: "array",
                items: { type: "string" },
              },
              tags: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error?.message || `OpenAI request failed (${response.status})`,
    );
  }

  const suggestions = parseJsonResponse(data);

  return {
    excerpt: normalizeText(suggestions?.excerpt),
    description: normalizeText(suggestions?.description),
    bestFor: normalizeStringArray(suggestions?.bestFor),
    tags: normalizeStringArray(suggestions?.tags),
  };
}

async function generateVenueSearchFilters(search) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("Missing env var: OPENAI_API_KEY");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You translate admin venue search requests into structured filters for deterministic matching. Do not answer with prose. Return strict JSON only. Use only the supported fields and avoid guessing specifics that were not asked for.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Interpret this admin venue search query and map it to supported filters:\n${JSON.stringify(search, null, 2)}\n\nSupported filters:\n- live: true | false | null\n- isPassVenue: true | false | null\n- staffPick: true | false | null\n- missingTags: boolean\n- missingExcerpt: boolean\n- missingDescription: boolean\n- missingOffers: boolean\n- missingImage: boolean\n- missingInstagram: boolean\n- weakCopy: boolean\n- textMention: string\n- category: string\n\nReturn JSON with exactly these keys: summary, filters, chips.\nRules:\n- summary: one short sentence describing the interpreted search.\n- chips: short human-readable labels for the interpreted filters.\n- textMention should only be present when the user asks to find venues mentioning a word or concept.\n- category should be one category slug if clearly requested, otherwise empty string.\n- Use null for live/isPassVenue/staffPick when not specified.\n- Do not invent unsupported filters.`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "venue_search_filters",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["summary", "filters", "chips"],
            properties: {
              summary: { type: "string" },
              chips: {
                type: "array",
                items: { type: "string" },
              },
              filters: {
                type: "object",
                additionalProperties: false,
                required: [
                  "live",
                  "isPassVenue",
                  "staffPick",
                  "missingTags",
                  "missingExcerpt",
                  "missingDescription",
                  "missingOffers",
                  "missingImage",
                  "missingInstagram",
                  "weakCopy",
                  "textMention",
                  "category",
                ],
                properties: {
                  live: { type: ["boolean", "null"] },
                  isPassVenue: { type: ["boolean", "null"] },
                  staffPick: { type: ["boolean", "null"] },
                  missingTags: { type: "boolean" },
                  missingExcerpt: { type: "boolean" },
                  missingDescription: { type: "boolean" },
                  missingOffers: { type: "boolean" },
                  missingImage: { type: "boolean" },
                  missingInstagram: { type: "boolean" },
                  weakCopy: { type: "boolean" },
                  textMention: { type: "string" },
                  category: { type: "string" },
                },
              },
            },
          },
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error?.message || `OpenAI request failed (${response.status})`,
    );
  }

  const result = parseJsonResponse(data);
  return {
    summary: normalizeText(result?.summary),
    chips: normalizeStringArray(result?.chips),
    filters: {
      live:
        typeof result?.filters?.live === "boolean" ? result.filters.live : null,
      isPassVenue:
        typeof result?.filters?.isPassVenue === "boolean"
          ? result.filters.isPassVenue
          : null,
      staffPick:
        typeof result?.filters?.staffPick === "boolean"
          ? result.filters.staffPick
          : null,
      missingTags: Boolean(result?.filters?.missingTags),
      missingExcerpt: Boolean(result?.filters?.missingExcerpt),
      missingDescription: Boolean(result?.filters?.missingDescription),
      missingOffers: Boolean(result?.filters?.missingOffers),
      missingImage: Boolean(result?.filters?.missingImage),
      missingInstagram: Boolean(result?.filters?.missingInstagram),
      weakCopy: Boolean(result?.filters?.weakCopy),
      textMention: normalizeText(result?.filters?.textMention),
      category: normalizeText(result?.filters?.category).toLowerCase(),
    },
  };
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" });
    }

    const task = normalizeText(body.task);

    if (task === "venue-copy") {
      const venue = buildVenuePayload(body.venue);
      if (!venue.name) {
        return json(400, { ok: false, error: "Venue name is required" });
      }

      const suggestions = await generateVenueCopySuggestions(venue);
      return json(200, { ok: true, suggestions });
    }

    if (task === "venue-search") {
      const search = buildVenueSearchPayload(body.query);
      if (!search.query) {
        return json(400, { ok: false, error: "Search query is required" });
      }

      const interpretation = await generateVenueSearchFilters(search);
      return json(200, { ok: true, interpretation });
    }

    return json(400, { ok: false, error: "Unsupported AI task" });
  } catch (error) {
    return json(error?.statusCode || 500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}
