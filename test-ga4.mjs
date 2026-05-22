import { GoogleAuth } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: 'https://www.googleapis.com/auth/analytics.readonly',
  });

  const client = await auth.getClient();
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

  const dimensions = [
    { name: 'date' },
    { name: 'dateHourMinute' },
    { name: 'transactionId' },
    { name: 'sessionSourceMedium' },
    { name: 'hostName' },
    { name: 'country' },
    { name: 'city' },
    { name: 'deviceCategory' }
  ];

  const requestBody = {
    dateRanges: [{ startDate: '2026-05-19', endDate: '2026-05-19' }],
    dimensions: dimensions,
    metrics: [
      { name: 'transactions' },
      { name: 'purchaseRevenue' }
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { value: 'purchase' }
      }
    }
  };

  try {
    const res = await client.request({
      url,
      method: 'POST',
      data: requestBody,
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response && err.response.data) {
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err);
    }
  }
}

run();
