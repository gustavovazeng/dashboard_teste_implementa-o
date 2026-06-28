export default async function handler(req, res) {
  const accounts = process.env.META_AD_ACCOUNT_IDS.split(',');
  const token = process.env.META_ACCESS_TOKEN;
  const fields = 'date_start,spend,impressions,reach,ad_id,ad_name,campaign_name,clicks,actions';
 
  const dateParam = req.query?.date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = dateParam || yesterday.toISOString().split('T')[0];
  const timeRange = encodeURIComponent(JSON.stringify({ since: dateStr, until: dateStr }));
 
  // Pega só a primeira conta para diagnóstico
  const accountId = accounts[0].trim();
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?fields=${fields}&time_range=${timeRange}&level=ad&limit=5&access_token=${token}`;
 
  const response = await fetch(url);
  const data = await response.json();
 
  if (!data.data || data.data.length === 0) {
    return res.status(200).json({ message: 'Sem dados', error: data.error });
  }
 
  // Retorna os action_types de cada anúncio e o permalink
  const adIds = data.data.map(r => r.ad_id).join(',');
  const permalinkRes = await fetch(`https://graph.facebook.com/v19.0/?ids=${adIds}&fields=instagram_permalink_url&access_token=${token}`);
  const permalinkData = await permalinkRes.json();
 
  const debug = data.data.map(row => ({
    ad_id: row.ad_id,
    ad_name: row.ad_name,
    action_types: (row.actions || []).map(a => ({ type: a.action_type, value: a.value })),
    instagram_permalink_url: permalinkData[row.ad_id]?.instagram_permalink_url || null
  }));
 
  res.status(200).json({ date: dateStr, sample: debug });
}
