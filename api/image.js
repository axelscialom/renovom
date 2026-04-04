export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { room, budget, style, photo } = req.body;

    const styleMap = {
      'Scandinave': 'Scandinavian interior, light oak wood, white walls, minimalist, cozy textiles, soft natural light',
      'Industriel': 'industrial loft interior, exposed concrete walls, black metal fixtures, Edison bulbs, raw textures',
      'Bohème': 'bohemian interior, rattan furniture, warm earthy tones, layered rugs, indoor plants, eclectic decor',
      'Vintage': 'vintage mid-century modern interior, retro furniture, warm patina, antique decorative details',
      'Contemporain': 'contemporary luxury interior, clean geometric lines, neutral palette, marble surfaces, premium finishes'
    };

    const roomMap = {
      'Cuisine': 'kitchen',
      'Chambre': 'bedroom',
      'Salle de bain': 'bathroom',
      'Salon': 'living room',
      'Bureau': 'home office',
      'Entrée': 'entrance hallway'
    };

    const styleDesc = styleMap[style] || 'modern interior';
    const roomDesc = roomMap[room] || 'room';

    // If photo uploaded, analyze room structure with GPT-4o-mini
    let roomContext = '';
    if (photo) {
      try {
        const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 80,
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: photo, detail: 'low' } },
                { type: 'text', text: 'Describe only: window positions, floor type, wall layout of this room. One sentence, English, factual only.' }
              ]
            }]
          })
        });
        const visionData = await visionRes.json();
        if (visionData.choices?.[0]?.message?.content) {
          roomContext = visionData.choices[0].message.content.trim();
        }
      } catch (e) {
        // Continue without vision context
      }
    }

    // Build a clean, DALL-E-safe prompt (English only, no user conversational text)
    const prompt = roomContext
      ? `Interior design photo, renovated ${roomDesc}, ${styleDesc}. Room layout: ${roomContext}. Professional photography, natural lighting, no people.`
      : `Interior design photo, renovated ${roomDesc}, ${styleDesc}. Professional photography, natural lighting, no people.`;

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
        size: '1024x1024',
        quality: 'standard'
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
