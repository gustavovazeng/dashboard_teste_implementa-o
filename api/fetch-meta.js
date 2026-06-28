export default async function handler(req, res) {
  const accounts = process.env.META_AD_ACCOUNT_IDS.split(',');
  const token = process.env.META_ACCESS_TOKEN;
  const fields = 'date_start,spend,impressions,reach,ad_id,ad_name,campaign_name,clicks,actions';
 
  const dateParam = req.query?.date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = dateParam || yesterday.toISOString().split('T')[0];
  const timeRange = encodeURIComponent(JSON.stringify({ since: dateStr, until: dateStr }));
 
  // Pega só a primeira conta, 3 anúncios para diagnóstico
  const accountId = accounts[0].trim();
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?fields=${fields}&time_range=${timeRange}&level=ad&limit=3&access_token=${token}`;
 
  const response = await fetch(url);
  const data = await response.json();
 
  if (!data.data || data.data.length === 0) {
    return res.status(200).json({ message: 'Sem dados', error: data.error });
  }
 
  const adIds = data.data.map(r => r.ad_id).join(',');
 
  // Testa múltiplas abordagens para pegar o link do Instagram
  const results = [];
  for (const row of data.data) {
    // Testa o endpoint /previews com generate_preview_link
    let previewLink = null;
    try {
      const previewRes = await fetch(
        `https://graph.facebook.com/v19.0/${row.ad_id}/previews?ad_format=INSTAGRAM_STANDARD&generate_preview_link=true&access_token=${token}`
      );
      const previewData = await previewRes.json();
      previewLink = previewData?.data?.[0]?.body || previewData?.error?.message || null;
    } catch (e) {
      previewLink = e.message;
    }
 
    results.push({
      ad_id: row.ad_id,
      ad_name: row.ad_name,
      preview_result: previewLink
    });
  }
 
  res.status(200).json({ date: dateStr, results });
}
