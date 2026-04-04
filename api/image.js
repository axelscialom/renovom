export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { room, style } = req.body;

    const styleMap = {
      'Scandinave':    'Scandinavian interior design, light oak wood furniture, white walls, minimalist decor, cozy textiles, soft natural light, clean lines',
      'Industriel':    'industrial loft interior design, exposed concrete walls, black metal fixtures, Edison bulb lighting, raw textures, dark tones',
      'Bohème':        'bohemian interior design, rattan furniture, warm earthy tones, layered rugs, lush indoor plants, eclectic colorful decor',
      'Vintage':       'vintage mid-century modern interior design, retro curved furniture, warm patina, antique decorative details, pastel tones',
      'Contemporain':  'contemporary luxury interior design, clean geometric lines, neutral palette, marble surfaces, premium finishes, dramatic lighting'
    };

    const roomMap = {
      'Cuisine':       'kitchen',
      'Chambre':       'bedroom',
      'Salle de bain': 'bathroom',
      'Salon':         'living room',
      'Bureau':        'home office',
      'Entrée':        'entrance hallway'
    };

    const styleDesc = styleMap[style] || 'modern interior design';
    const roomDesc  = roomMap[room]   || 'room';

    // Clean, minimal prompt — no dynamic user content to avoid validation errors
    const prompt = `Professional interior design photography of a beautifully renovated ${roomDesc}. Style: ${styleDesc}. Bright natural lighting, no people, photorealistic, high quality.`;

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

    if (!data.data?.[0]?.url) {
      return res.status(500).json({ error: 'No image returned by DALL-E' });
    }

    res.status(200).json({ imageUrl: data.data[0].url });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
