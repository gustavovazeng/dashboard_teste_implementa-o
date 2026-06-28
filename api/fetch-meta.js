export default async function handler(req, res) {
  const accounts = process.env.META_AD_ACCOUNT_IDS.split(',');
  const token = process.env.META_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const fields = 'date_start,spend,impressions,reach,ad_id,ad_name,campaign_name,clicks,actions';
 
  // Data dinâmica: ontem (ou passe ?date=2026-06-26 na URL para testar)
  const dateParam = req.query?.date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = dateParam || yesterday.toISOString().split('T')[0];
 
  // time_range precisa ser URL-encoded — esse era o bug
  const timeRange = encodeURIComponent(JSON.stringify({ since: dateStr, until: dateStr }));
 
  let allRows = [];
  const errors = [];
 
  for (const accountId of accounts) {
    const url = `https://graph.facebook.com/v19.0/${accountId.trim()}/insights?fields=${fields}&time_range=${timeRange}&level=ad&limit=500&access_token=${token}`;
 
    try {
      const response = await fetch(url);
      const data = await response.json();
 
      if (data.error) {
        errors.push({ account: accountId, error: data.error.message });
        continue;
      }
 
      if (!data.data || data.data.length === 0) continue;
 
      for (const row of data.data) {
        const actions = row.actions || [];
        const linkClicks = actions.find(a => a.action_type === 'link_click')?.value || 0;
        const landingViews = actions.find(a => a.action_type === 'landing_page_view')?.value || 0;
        const initiateCheckout = actions.find(a => a.action_type === 'initiate_checkout')?.value || 0;
 
        allRows.push({
          date: row.date_start,
          spend: parseFloat(row.spend || 0),
          link_clicks: parseInt(linkClicks),
          impressions: parseInt(row.impressions || 0),
          reach: parseInt(row.reach || 0),
          ad_id: row.ad_id,
          ad_name: row.ad_name,
          instagram_url: null,
          landing_page_views: parseInt(landingViews),
          initiate_checkout: parseInt(initiateCheckout),
          campaign_name: row.campaign_name
        });
      }
    } catch (e) {
      errors.push({ account: accountId, error: e.message });
    }
  }
 
  if (allRows.length === 0) {
    return res.status(200).json({
      success: false,
      rows: 0,
      date: dateStr,
      message: 'Sem dados',
      errors
    });
  }
 
  // Upsert no Supabase (evita duplicar ao rodar duas vezes no mesmo dia)
  const insert = await fetch(`${supabaseUrl}/rest/v1/meta_ads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(allRows)
  });
 
  if (insert.ok) {
    res.status(200).json({ success: true, rows: allRows.length, date: dateStr, errors });
  } else {
    const err = await insert.text();
    res.status(500).json({ success: false, error: err, rows: allRows.length });
  }
}
