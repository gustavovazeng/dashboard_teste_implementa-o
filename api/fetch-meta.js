export default async function handler(req, res) {
  const accounts = process.env.META_AD_ACCOUNT_IDS.split(',');
  const token = process.env.META_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
 
  const dateParam = req.query?.date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = dateParam || yesterday.toISOString().split('T')[0];
 
  const timeRange = JSON.stringify({ since: dateStr, until: dateStr });
  const insightFields = `insights.time_range(${timeRange}){date_start,spend,impressions,reach,clicks,actions}`;
  const fields = `id,name,campaign{name},creative{instagram_permalink_url},${insightFields}`;
 
  let allRows = [];
  const errors = [];
 
  for (const accountId of accounts) {
    const url = `https://graph.facebook.com/v25.0/${accountId.trim()}/ads?fields=${encodeURIComponent(fields)}&limit=500&access_token=${token}`;
 
    try {
      const response = await fetch(url);
      const data = await response.json();
 
      if (data.error) {
        errors.push({ account: accountId, error: data.error.message });
        continue;
      }
 
      if (!data.data || data.data.length === 0) continue;
 
      for (const ad of data.data) {
        if (!ad.insights?.data?.[0]) continue;
 
        const insight = ad.insights.data[0];
        const actions = insight.actions || [];
 
        const linkClicks       = actions.find(a => a.action_type === 'link_click')?.value || 0;
        const landingViews     = actions.find(a => a.action_type === 'landing_page_view')?.value || 0;
        const initiateCheckout = actions.find(a => a.action_type === 'initiate_checkout')?.value || 0;
        const profileVisits    = actions.find(a => a.action_type === 'instagram_profile_visit')?.value || 0;
        const newFollowers     = actions.find(a => a.action_type === 'follow')?.value || 0;
 
        allRows.push({
          date: insight.date_start,
          spend: parseFloat(insight.spend || 0),
          link_clicks: parseInt(linkClicks),
          impressions: parseInt(insight.impressions || 0),
          reach: parseInt(insight.reach || 0),
          ad_id: ad.id,
          ad_name: ad.name,
          instagram_url: ad.creative?.instagram_permalink_url || null,
          landing_page_views: parseInt(landingViews),
          initiate_checkout: parseInt(initiateCheckout),
          campaign_name: ad.campaign?.name || null,
          profile_visits: parseInt(profileVisits),
          new_followers: parseInt(newFollowers)
        });
      }
    } catch (e) {
      errors.push({ account: accountId, error: e.message });
    }
  }
 
  if (allRows.length === 0) {
    return res.status(200).json({ success: false, rows: 0, date: dateStr, message: 'Sem dados', errors });
  }
 
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
    const sample = allRows.slice(0, 3).map(r => ({ ad_id: r.ad_id, ad_name: r.ad_name, instagram_url: r.instagram_url }));
    res.status(200).json({ success: true, rows: allRows.length, date: dateStr, errors, sample });
  } else {
    const err = await insert.text();
    res.status(500).json({ success: false, error: err, rows: allRows.length });
  }
}
