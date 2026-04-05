const budgetMap = {
  'Moins de 500€':    'low budget — 3 tiers: ~30€, ~80€, ~150€',
  '500 – 1 500€':    'mid budget — 3 tiers: ~80€, ~200€, ~400€',
  '1 500 – 5 000€':  'good budget — 3 tiers: ~150€, ~400€, ~800€',
  '+ 5 000€':        'premium budget — 3 tiers: ~300€, ~800€, ~2000€'
};

const styleHints = {
  'Scandinave': 'light oak, white/beige, linen, minimalist, Scandinavian brands',
  'Industriel': 'black metal, concrete, dark tones, raw materials, urban loft',
  'Bohème': 'rattan, terracotta, warm tones, natural textiles, eclectic',
  'Vintage': 'patina, velvet, dark wood, brass, mid-century modern',
  'Contemporain': 'clean lines, black/white/grey, marble, glass, premium'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { elements = [], style = '', budget = '' } = req.body || {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquante' });

  if (elements.length === 0) return res.status(200).json({ products: {} });

  const budgetDesc = budgetMap[budget] || 'mid budget — 3 tiers: ~80€, ~200€, ~400€';
  const styleDesc = styleHints[style] || 'modern';
  const elementList = elements.map(e => e.name).join(', ');

  const systemPrompt = `You are a French interior design expert. You know products from Leroy Merlin, IKEA, Castorama, Maisons du Monde, La Redoute, and Brico Dépôt. You reply ONLY with valid JSON, no text before or after.`;

  const userPrompt = `Style: ${style} (${styleDesc})
Budget level: ${budgetDesc}
Elements to furnish: ${elementList}

For EACH element, provide EXACTLY 3 product options ordered from cheapest to most expensive.
Use real product names from French stores.

Reply ONLY with this JSON structure (no text before or after):
{
  "products": {
    "ElementName": [
      {
        "name": "Exact product name as sold in store",
        "description": "Short description in French, one sentence",
        "store": "IKEA",
        "price": 149,
        "icon": "🛏️",
        "iconBg": "#F5F0E8",
        "delivery": "Click & Collect gratuit · Livraison à domicile dès 49€",
        "searchQuery": "MALM lit cadre",
        "dalleDescription": "light oak Scandinavian bed frame with white linen bedding, minimalist style"
      }
    ]
  }
}

Rules:
- searchQuery: 2-4 key words in French that will find this exact product in the store's search engine (e.g. "MALM lit chêne" or "peinture blanc mat 10L"). Use the product reference/model name if known.
- dalleDescription: English, 10-15 words, describes what the product looks like visually for an AI image prompt
- icon: single emoji matching the element
- iconBg: soft hex color matching style (Scandinave: #F5F0E8, Industriel: #3A3A4A, Bohème: #FAEEDA, Vintage: #F8F0E8, Contemporain: #F0F0F5)
- store: must be one of: Leroy Merlin, IKEA, Castorama, Maisons du Monde, La Redoute, Brico Dépôt
- delivery per store:
  - Leroy Merlin: "Livraison gratuite dès 25€ · Click & Collect disponible"
  - IKEA: "Click & Collect gratuit · Livraison à domicile dès 49€"
  - Castorama: "Livraison sous 3-5 jours ouvrés · Click & Collect 2h"
  - Maisons du Monde: "Livraison à domicile · Retrait en magasin offert"
  - La Redoute: "Livraison gratuite dès 60€ · Retour 30 jours offert"
  - Brico Dépôt: "Livraison sous 48h · Click & Collect disponible"
- price: realistic number (no currency symbol)
- Elements to include in response: ${elementList}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = data.content[0].text.trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const rawJson = text.match(/(\{[\s\S]*\})/);
      const src = codeBlock ? codeBlock[1] : rawJson ? rawJson[1] : null;
      if (src) parsed = JSON.parse(src);
      else throw new Error('Non-parseable AI response');
    }

    if (!parsed.products || typeof parsed.products !== 'object') {
      throw new Error('Invalid products structure');
    }

    return res.status(200).json({ products: parsed.products });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
