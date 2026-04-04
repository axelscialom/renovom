export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { room, budget, style, notes, photo } = req.body;

    const styleMap = {
      'Scandinave': 'Scandinavian interior, light oak wood, white walls, minimalist, cozy textiles',
      'Industriel': 'industrial loft, exposed concrete, black metal, Edison bulbs, raw materials',
      'Bohème': 'bohemian interior, rattan, warm earthy tones, layered textiles, indoor plants',
      'Vintage': 'vintage retro, mid-century modern furniture, warm patina, antique details',
      'Contemporain': 'contemporary luxury, clean geometric lines, neutral palette, marble and glass'
    };

    const roomMap = {
      'Cuisine': 'kitchen',
      'Chambre': 'bedroom',
      'Salle de bain': 'bathroom',
      'Salon': 'living room',
      'Bureau': 'home office',
      'Entrée': 'entrance hallway'
    };

    const styleDesc = styleMap[style] || style;
    const roomDesc = roomMap[room] || room;
    const notesStr = notes && notes.length > 0 ? notes.slice(0, 2).join(', ') : '';

    // Step 1: If photo uploaded, use GPT-4o-mini vision to extract room layout
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
            max_tokens: 100,
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: photo, detail: 'low' } },
                { type: 'text', text: 'Describe this room in 1 sentence: wall structure, windows position, floor type, approximate size. English only, no extra text.' }
              ]
            }]
          })
        });
        const visionData = await visionRes.json();
        if (visionData.choices?.[0]?.message?.content) {
          roomContext = visionData.choices[0].message.content;
        }
      } catch (e) {
        // Vision failed, continue without it
      }
    }

    // Step 2: Build DALL-E prompt
    const basePrompt = roomContext
      ? `Photorealistic interior design render of a ${roomDesc} with this exact layout: ${roomContext}. Fully renovated in ${styleDesc} style`
      : `Photorealistic interior design photograph of a beautifully renovated ${roomDesc}, ${styleDesc} style`;

    const prompt = `${basePrompt}${notesStr ? ', ' + notesStr : ''}, professional lighting, magazine quality, architectural digest style, no people, 4K`;

    // Step 3: Generate with DALL-E 3
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
