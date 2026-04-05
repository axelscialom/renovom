const defaultElements = {
  'Chambre':       [{ name: 'Lit', icon: '🛏️' }, { name: 'Armoire', icon: '🗄️' }, { name: 'Bureau', icon: '🪑' }, { name: 'Luminaire', icon: '💡' }, { name: 'Peinture murale', icon: '🎨' }],
  'Salon':         [{ name: 'Canapé', icon: '🛋️' }, { name: 'Table basse', icon: '🪵' }, { name: 'Meuble TV', icon: '📺' }, { name: 'Luminaire', icon: '💡' }, { name: 'Peinture murale', icon: '🎨' }],
  'Cuisine':       [{ name: 'Plan de travail', icon: '🍳' }, { name: 'Rangements', icon: '🗄️' }, { name: 'Luminaire', icon: '💡' }, { name: 'Crédence', icon: '🪵' }, { name: 'Peinture murale', icon: '🎨' }],
  'Salle de bain': [{ name: 'Vasque / lavabo', icon: '🚿' }, { name: 'Miroir', icon: '🪞' }, { name: 'Rangements', icon: '🗄️' }, { name: 'Luminaire', icon: '💡' }, { name: 'Peinture murale', icon: '🎨' }],
  'Bureau':        [{ name: 'Bureau', icon: '🪑' }, { name: 'Chaise ergonomique', icon: '💺' }, { name: 'Étagères', icon: '📚' }, { name: 'Luminaire', icon: '💡' }, { name: 'Peinture murale', icon: '🎨' }],
  'Entrée':        [{ name: 'Meuble à chaussures', icon: '👟' }, { name: 'Miroir', icon: '🪞' }, { name: 'Porte-manteau', icon: '🧥' }, { name: 'Luminaire', icon: '💡' }, { name: 'Peinture murale', icon: '🎨' }]
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { photo, room } = req.body || {};
  const fallback = defaultElements[room] || defaultElements['Salon'];

  if (!photo) return res.status(200).json({ elements: fallback });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(200).json({ elements: fallback });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Look at this ${room || 'room'} photo and list the main furniture and decor elements visible. Reply ONLY with a JSON array of up to 7 objects: [{"name":"...", "icon":"..."}]. Use French names. Each icon must be a single emoji. Always include {"name":"Peinture murale","icon":"🎨"}.`
            },
            { type: 'image_url', image_url: { url: photo, detail: 'low' } }
          ]
        }]
      })
    });

    clearTimeout(timeout);

    if (!visionRes.ok) return res.status(200).json({ elements: fallback });

    const visionData = await visionRes.json();
    const text = visionData.choices?.[0]?.message?.content || '';

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return res.status(200).json({ elements: fallback });

    const elements = JSON.parse(match[0]);
    if (!Array.isArray(elements) || elements.length === 0) return res.status(200).json({ elements: fallback });

    // Ensure Peinture murale is present
    const hasPeinture = elements.some(e => e.name === 'Peinture murale');
    if (!hasPeinture) elements.push({ name: 'Peinture murale', icon: '🎨' });

    return res.status(200).json({ elements: elements.slice(0, 7) });
  } catch (e) {
    return res.status(200).json({ elements: fallback });
  }
}
