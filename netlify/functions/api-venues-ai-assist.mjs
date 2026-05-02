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

    if (normalizeText(body.task) !== "venue-copy") {
      return json(400, { ok: false, error: "Unsupported AI task" });
    }

    const venue = buildVenuePayload(body.venue);
    if (!venue.name) {
      return json(400, { ok: false, error: "Venue name is required" });
    }

    const suggestions = await generateVenueCopySuggestions(venue);
    return json(200, { ok: true, suggestions });
  } catch (error) {
    return json(error?.statusCode || 500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}
