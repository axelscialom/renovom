export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { room, budget, style, notes } = req.body;

    const styleMap = {
      'Scandinave': 'Scandinavian interior, light oak wood, white walls, minimalist clean design, cozy textiles',
      'Industriel': 'industrial loft interior, exposed concrete, black metal frames, Edison bulbs, raw materials',
      'Bohème': 'bohemian interior, rattan furniture, warm earthy tones, layered textiles, indoor plants, eclectic decor',
      'Vintage': 'vintage retro interior, mid-century modern furniture, warm patina, antique details, nostalgic charm',
      'Contemporain': 'contemporary luxury interior, clean geometric lines, neutral palette, premium marble and glass finishes'
    };

    const roomMap = {
      'Cuisine': 'kitchen',
      'Chambre': 'bedroom',
      'Salle de bain': 'bathroom',
      'Salon': 'living room',
      'Bureau': 'home office study',
      'Entrée': 'entrance hallway'
    };

    const styleDesc = styleMap[style] || style;
    const roomDesc = roomMap[room] || room;

    // Extract user's preferences from chat notes (skip generic phrases)
    const notesStr = notes && notes.length > 0
      ? ', ' + notes.slice(0, 3).join(', ')
      : '';

    const prompt = `Professional interior design photograph of a beautifully renovated ${roomDesc}, ${styleDesc}${notesStr}, natural lighting, magazine quality, high-end renovation, photorealistic, 8K detail, architectural digest editorial style, no people, wide angle shot showing the full room`;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024',
        quality: 'hd'
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    res.status(200).json({ imageUrl: data.data[0].url });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
