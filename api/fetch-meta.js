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
  const creativeRes = await fetch(
    `https://graph.facebook.com/v19.0/?ids=${adIds}&fields=instagram_permalink_url,creative{id,instagram_permalink_url,effective_object_story_id,object_story_id}&access_token=${token}`
  );
  const creativeData = await creativeRes.json();
 
  // Para cada anúncio, tenta buscar o story object se tiver effective_object_story_id
  const results = [];
  for (const row of data.data) {
    const adData = creativeData[row.ad_id] || {};
    const creative = adData.creative || {};
    const storyId = creative.effective_object_story_id || creative.object_story_id || null;
 
    let storyPermalink = null;
    if (storyId) {
      try {
        const storyRes = await fetch(
          `https://graph.facebook.com/v19.0/${storyId}?fields=instagram_permalink_url&access_token=${token}`
        );
        const storyData = await storyRes.json();
        storyPermalink = storyData.instagram_permalink_url || null;
      } catch (e) {}
    }
 
    results.push({
      ad_id: row.ad_id,
      ad_name: row.ad_name,
      // abordagem 1: direto no ad
      permalink_via_ad: adData.instagram_permalink_url || null,
      // abordagem 2: via creative
      permalink_via_creative: creative.instagram_permalink_url || null,
      // abordagem 3: via story object
      effective_object_story_id: storyId,
      permalink_via_story: storyPermalink
    });
  }
 
  res.status(200).json({ date: dateStr, results });
}
