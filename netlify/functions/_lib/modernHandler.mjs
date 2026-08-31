function toLegacyHeaders(headers) {
  return Object.fromEntries(headers.entries());
}

function toLegacyQuery(url) {
  const values = {};
  for (const [key, value] of url.searchParams) values[key] = value;
  return values;
}

async function toLegacyEvent(request) {
  const url = new URL(request.url);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  return {
    httpMethod: request.method,
    headers: toLegacyHeaders(request.headers),
    body: hasBody ? await request.text() : null,
    path: url.pathname,
    rawUrl: request.url,
    queryStringParameters: toLegacyQuery(url),
    isBase64Encoded: false,
  };
}

function toResponse(result = {}) {
  const status = Number(result.statusCode || 200);
  const emptyBody = status === 204 || status === 205 || status === 304;
  return new Response(emptyBody ? null : (result.body ?? ""), {
    status,
    headers: result.headers,
  });
}

export function modernHandler(handler) {
  return async (request, context) =>
    toResponse(await handler(await toLegacyEvent(request), context));
}