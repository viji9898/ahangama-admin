import test from "node:test";
import assert from "node:assert/strict";
import { parseFollowBreakdown } from "./metaInstagramApi.mjs";

test("parses follows and unfollows from Meta breakdowns", () => {
  assert.deepEqual(
    parseFollowBreakdown({
      data: [
        {
          total_value: {
            breakdowns: [
              {
                results: [
                  { dimension_values: ["FOLLOWER"], value: 39 },
                  { dimension_values: ["NON_FOLLOWER"], value: 3 },
                ],
              },
            ],
          },
        },
      ],
    }),
    { follows: 39, unfollows: 3 },
  );
});