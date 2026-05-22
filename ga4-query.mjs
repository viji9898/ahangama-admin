import { GoogleAuth } from 'google-auth-library';
import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!propertyId || !clientEmail || !privateKey) { console.error("Missing credentials"); return; }
  const auth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: 'https://www.googleapis.com/auth/analytics.readonly',
  });
  const client = await auth.getClient();
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const dateRanges = [{ startDate: 'yesterday', endDate: 'today' }];
  async function getReport(dimensions, metrics, dimensionFilter = null) {
      try {
          const res = await client.request({ url, method: 'POST', data: { dateRanges, dimensions, metrics, dimensionFilter, keepEmptyRows: true }, });
          return res.data;
      } catch (err) { return { error: err.response?.data || err.message }; }
  }
  const pageViewReport = await getReport([{ name: 'customEvent:qr_venue' }], [{ name: 'eventCount' }], { filter: { fieldName: 'eventName', stringFilter: { value: 'qr_venue_page_view' } } });
  const clickReport = await getReport([{ name: 'customEvent:qr_venue' }], [{ name: 'eventCount' }], { filter: { fieldName: 'eventName', stringFilter: { value: 'qr_pass_cta_click' } } });
  let purchaseReport = await getReport(
      [{ name: 'customEvent:qr_venue' }], 
      [{ name: 'eventCount' }, { name: 'purchaseRevenue' }],
      { andGroup: { expressions: [
          { filter: { fieldName: 'eventName', stringFilter: { value: 'purchase' } } },
          { filter: { fieldName: 'customEvent:flow_type', stringFilter: { value: 'promo' } } }
      ] } }
  );
  const venues = {};
  const processRows = (report, venueIndex, metricIndex, metricName, isRevenue = false) => {
    if (report.error || !report.rows) return;
    report.rows.forEach(row => {
        const venue = row.dimensionValues[venueIndex].value || '(not set)';
        const val = parseFloat(row.metricValues[metricIndex].value);
        if (!venues[venue]) venues[venue] = { views: 0, clicks: 0, purchases: 0, revenue: 0 };
        if (isRevenue) venues[venue].revenue += val;
        else if (metricName === 'views') venues[venue].views += val;
        else if (metricName === 'clicks') venues[venue].clicks += val;
        else if (metricName === 'purchases') venues[venue].purchases += val;
    });
  };
  processRows(pageViewReport, 0, 0, 'views');
  processRows(clickReport, 0, 0, 'clicks');
  processRows(purchaseReport, 0, 0, 'purchases');
  processRows(purchaseReport, 0, 1, 'revenue', true);
  let totalViews = 0, totalClicks = 0, totalPurchases = 0, totalRevenue = 0;
  Object.values(venues).forEach(v => { totalViews += v.views; totalClicks += v.clicks; totalPurchases += v.purchases; totalRevenue += v.revenue; });
  console.log("\nSummary (Last 24h - yesterday/today):");
  console.log(`Total Views: ${totalViews}`);
  console.log(`Total Clicks: ${totalClicks}`);
  console.log(`Total Purchases: ${totalPurchases}`);
  console.log(`Total Revenue: ${totalRevenue.toFixed(2)}`);
  console.log("\nVenue Breakdown:");
  console.table(Object.entries(venues).sort((a, b) => b[1].views - a[1].views).map(([venue, stats]) => ({ Venue: venue, ...stats })));
}
run();
