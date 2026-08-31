import { modernHandler } from "./_lib/modernHandler.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { queryFromEnv } from "./_lib/db.mjs";

const DATABASE_ENV = "NETLIFY_DATABASE_URL";
const EXCLUDED_EMAILS = [
  "hello@viji.com",
  "viji@viji.com",
  "vijitha.wijesuriya@gmail.com",
];

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(event);

    const result = await queryFromEnv(
      DATABASE_ENV,
      `
        SELECT
          id::text,
          'Standard pass' AS purchase_source,
          NULLIF(pass_holder_name, '') AS customer_name,
          customer_email,
          NULLIF(customer_phone, '') AS customer_phone,
          pass_type AS product,
          price_usd AS amount_usd,
          'USD' AS currency,
          status,
          start_date,
          expiry_date,
          stripe_session_id,
          stripe_payment_intent_id,
          receipt_url,
          created_at
        FROM purchases
        WHERE status = 'paid'
          AND price_usd > 0
          AND NULLIF(TRIM(stripe_payment_intent_id), '') IS NOT NULL
          AND LOWER(TRIM(customer_email)) <> ALL($1::text[])

        UNION ALL

        SELECT
          id::text,
          'Promo purchase' AS purchase_source,
          NULLIF(customer_name, '') AS customer_name,
          customer_email,
          NULLIF(customer_phone, '') AS customer_phone,
          COALESCE(NULLIF(product_name, ''), NULLIF(flow_type, ''), 'Promo pass') AS product,
          charged_price_usd AS amount_usd,
          currency,
          fulfillment_status AS status,
          start_date,
          expiry_date,
          stripe_session_id,
          stripe_payment_intent_id,
          stripe_receipt_url AS receipt_url,
          created_at
        FROM promo_purchases
        WHERE charged_price_usd > 0
          AND NULLIF(TRIM(stripe_payment_intent_id), '') IS NOT NULL
          AND LOWER(TRIM(customer_email)) <> ALL($1::text[])

        ORDER BY created_at DESC
        LIMIT 1000
      `,
      [EXCLUDED_EMAILS],
    );

    return json(200, {
      ok: true,
      transactions: result.rows,
    });
  } catch (e) {
    return json(e?.statusCode || 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}

export default modernHandler(handler);
