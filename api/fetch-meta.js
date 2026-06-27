export default async function handler(req, res) {
  const accounts = process.env.META_AD_ACCOUNT_IDS.split(',');
  const token = process.env.META_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  const fields = [
    'date_start',
    'spend',
    'actions',
    'impressions',
    'reach',
    'ad_id',
    'ad_name',
    'instagram_permalink_url',
    'campaign_name'
  ].join(',');

const dateStr = '2026-06-26';

  let allRows = [];

  for (const accountId of accounts) {
    const url = `https://graph.facebook.com/v19.0/${accountId}/insights?fields=${fields}&time_range={"since":"${dateStr}","until":"${dateStr}"}&level=ad&access_token=${token}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.data) continue;

    for (const row of data.data) {
      const linkClicks = row.actions?.find(a => a.action_type === 'link_click')?.value || 0;
      const landingViews = row.actions?.find(a => a.action_type === 'landing_page_view')?.value || 0;
      const initiateCheckout = row.actions?.find(a => a.action_type === 'initiate_checkout')?.value || 0;

      allRows.push({
        date: row.date_start,
        spend: parseFloat(row.spend || 0),
        link_clicks: parseInt(linkClicks),
        impressions: parseInt(row.impressions || 0),
        reach: parseInt(row.reach || 0),
        ad_id: row.ad_id,
        ad_name: row.ad_name,
        instagram_url: row.instagram_permalink_url || null,
        landing_page_views: parseInt(landingViews),
        initiate_checkout: parseInt(initiateCheckout),
        campaign_name: row.campaign_name
      });
    }
  }

  // Salva no Supabase
  const insert = await fetch(`${supabaseUrl}/rest/v1/meta_ads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(allRows)
  });

  if (insert.ok) {
    res.status(200).json({ success: true, rows: allRows.length });
  } else {
    const err = await insert.text();
    res.status(500).json({ success: false, error: err });
  }
}
