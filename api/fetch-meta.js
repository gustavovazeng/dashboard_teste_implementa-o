export default async function handler(req, res) {
  const accounts = process.env.META_AD_ACCOUNT_IDS.split(',');
  const token = process.env.META_ACCESS_TOKEN;

  const fields = 'date_start,spend,impressions,reach,ad_id,ad_name,campaign_name';
  const dateStr = '2026-06-26';

  const results = [];

  for (const accountId of accounts) {
    const url = `https://graph.facebook.com/v19.0/${accountId}/insights?fields=${fields}&time_range={"since":"${dateStr}","until":"${dateStr}"}&level=ad&access_token=${token}`;
    const response = await fetch(url);
    const data = await response.json();
    results.push({ accountId, data });
  }

  res.status(200).json(results);
}
