import assert from "node:assert/strict";
import test from "node:test";
import { getVenueFromApi } from "./venueApi.mjs";

test("getVenueFromApi returns only an exact venue match", async () => {
  const requests = [];
  const queryImpl = async (sql, params) => {
    requests.push({ sql, params });
    return {
      rows: [
        {
          id: "patels-ahangama",
          slug: "patels-ahangama",
          name: "Petals",
        },
      ],
    };
  };

  const venue = await getVenueFromApi("patels-ahangama", {
    queryImpl,
  });

  assert.equal(venue.id, "patels-ahangama");
  assert.deepEqual(requests[0].params, ["patels-ahangama"]);
  assert.match(requests[0].sql, /lower\(id\) = \$1/);
});