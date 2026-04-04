export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { photo, room } = req.body;

    // Default elements per room (used when no photo or vision fails)
    const defaultElements = {
      'Cuisine':       [{ name:'Peinture murale',icon:'🎨' },{ name:'Luminaire',icon:'💡' },{ name:'Robinetterie',icon:'🚿' },{ name:'Plan de travail',icon:'🔲' },{ name:'Tabouret de bar',icon:'🪑' }],
      'Chambre':       [{ name:'Peinture murale',icon:'🎨' },{ name:'Lit',icon:'🛏️' },{ name:'Luminaire',icon:'💡' },{ name:'Rangement',icon:'🗄️' },{ name:'Tapis',icon:'🟫' }],
      'Salon':         [{ name:'Peinture murale',icon:'🎨' },{ name:'Canapé',icon:'🛋️' },{ name:'Table basse',icon:'🪑' },{ name:'Luminaire',icon:'💡' },{ name:'Tapis',icon:'🟫' }],
      'Salle de bain': [{ name:'Peinture murale',icon:'🎨' },{ name:'Miroir',icon:'🪞' },{ name:'Luminaire',icon:'💡' },{ name:'Meuble vasque',icon:'🚿' },{ name:'Accessoires',icon:'🪥' }],
      'Bureau':        [{ name:'Peinture murale',icon:'🎨' },{ name:'Bureau',icon:'🖥️' },{ name:'Fauteuil',icon:'🪑' },{ name:'Luminaire',icon:'💡' },{ name:'Étagère',icon:'📚' }],
      'Entrée':        [{ name:'Peinture murale',icon:'🎨' },{ name:'Miroir',icon:'🪞' },{ name:'Portemanteau',icon:'🚪' },{ name:'Luminaire',icon:'💡' },{ name:'Meuble à chaussures',icon:'👟' }]
    };

    if (!photo) {
      return res.status(200).json({ elements: defaultElements[room] || defaultElements['Salon'] });
    }

    // Analyze with GPT-4o vision (5s timeout to stay fast)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: photo, detail: 'low' } },
            {
              type: 'text',
              text: `Analyze this ${room} photo. Identify ALL visible furniture and renovatable elements (walls, floor, furniture, lighting, curtains, rugs, fixtures, etc.).
Return ONLY a valid JSON array, no text before or after. Max 7 elements.
Format: [{"name":"Nom en français","icon":"emoji"}]
Examples of names: Peinture murale, Lit double, Armoire, Luminaire, Tapis, Canapé, Table basse, Parquet, Rideaux, Miroir`
            }
          ]
        }]
      })
    });

    clearTimeout(timeout);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.choices[0].message.content.trim();
    let elements;

    try {
      const match = text.match(/\[[\s\S]*\]/);
      elements = JSON.parse(match ? match[0] : text);
      if (!Array.isArray(elements) || elements.length === 0) throw new Error('empty');
    } catch (e) {
      elements = defaultElements[room] || defaultElements['Salon'];
    }

    // Ensure paint is always present (most common renovation element)
    const hasPaint = elements.some(el =>
      el.name.toLowerCase().includes('peinture') || el.name.toLowerCase().includes('mur')
    );
    if (!hasPaint) elements.unshift({ name: 'Peinture murale', icon: '🎨' });

    return res.status(200).json({ elements: elements.slice(0, 7) });

  } catch (e) {
    // Always return usable defaults on any error
    const fallback = [
      { name: 'Peinture murale', icon: '🎨' },
      { name: 'Mobilier principal', icon: '🛋️' },
      { name: 'Luminaire', icon: '💡' },
      { name: 'Accessoires déco', icon: '🪴' }
    ];
    return res.status(200).json({ elements: fallback });
  }
}
