import { query } from "./db.mjs";
import { VENUES_TABLE, toVenueDto } from "./venues260414.mjs";

export async function getVenueFromApi(
  identifier,
  { queryImpl = query } = {},
) {
  const normalizedIdentifier = String(identifier || "").trim().toLowerCase();
  if (!normalizedIdentifier) throw new Error("Missing venue identifier");

  const result = await queryImpl(
    `
      SELECT *
      FROM ${VENUES_TABLE}
      WHERE deleted_at IS NULL
        AND (
          lower(id) = $1
          OR lower(slug) = $1
          OR lower(name) = $1
        )
      LIMIT 1
    `,
    [normalizedIdentifier],
  );

  return result.rows[0] ? toVenueDto(result.rows[0]) : null;
}