import assert from "node:assert/strict";
import test from "node:test";
import { getVenueFromApi } from "./venueApi.mjs";

test("getVenueFromApi returns only an exact venue match", async () => {
  process.env.ADMIN_IMPORT_SECRET = "test-secret";
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return new Response(
      JSON.stringify({
        venues: [
          { id: "petals-rooftop", slug: "petals-rooftop", name: "Petals Rooftop" },
          { id: "patels-ahangama", slug: "patels-ahangama", name: "Petals" },
        ],
      }),
    );
  };

  const venue = await getVenueFromApi("patels-ahangama", {
    fetchImpl,
    baseUrl: "https://example.com",
  });

  assert.equal(venue.id, "patels-ahangama");
  assert.equal(
    requests[0].url.searchParams.get("identifier"),
    "patels-ahangama",
  );
  assert.equal(
    requests[0].options.headers["x-admin-import-secret"],
    "test-secret",
  );
});