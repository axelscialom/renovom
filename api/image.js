export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { room, style, photo, roomType, selectedProducts, refinementNote } = req.body;

    const roomDesc = {
      'Cuisine': 'kitchen', 'Chambre': 'bedroom', 'Salle de bain': 'bathroom',
      'Salon': 'living room', 'Bureau': 'home office', 'Entrée': 'entrance hallway'
    }[room] || 'room';

    const styleDesc = {
      'Scandinave':   'Scandinavian style with light oak wood, white walls, minimalist cozy textiles',
      'Industriel':   'industrial loft style with exposed metal, concrete walls, Edison bulbs',
      'Bohème':       'bohemian style with rattan furniture, warm earthy tones, indoor plants',
      'Vintage':      'vintage mid-century modern style with warm patina and retro furniture',
      'Contemporain': 'contemporary luxury style with marble, clean lines, premium finishes'
    }[style] || 'modern interior style';

    const apiKey = (process.env.OPENAI_API_KEY || '').trim();

    // Build product change list for the prompt
    const changeLines = selectedProducts
      ? Object.entries(selectedProducts).map(([element, product]) => {
          const desc = product.dalleDescription || product.name;
          return `- ${element}: replace with ${desc} (${product.store})`;
        }).join('\n')
      : '';

    const adjustments = refinementNote ? `\nUser adjustments: ${refinementNote.replace(/[^\x20-\x7E]/g, ' ').trim()}` : '';

    // ── PATH A: furnished room with photo → use gpt-image-1 editing ──────────
    if (photo && roomType === 'meuble') {
      const editPrompt = `Transform this ${roomDesc} to ${styleDesc}.
Apply these specific product changes:
${changeLines || '- Apply the chosen interior style throughout the room'}${adjustments}
Important: keep the same room layout and architecture. Only change the specified furniture, surfaces and finishes. Professional interior photography, bright natural light, no people.`;

      try {
        const base64Data = photo.replace(/^data:image\/[a-z+]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

        const formData = new FormData();
        formData.append('model', 'gpt-image-1');
        formData.append('image[]', imageBlob, 'room.png');
        formData.append('prompt', editPrompt);
        formData.append('n', '1');
        formData.append('size', '1024x1024');

        const editRes = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: formData
        });

        const editData = await editRes.json();

        if (editData.data?.[0]) {
          const url = editData.data[0].url
            || (editData.data[0].b64_json ? `data:image/png;base64,${editData.data[0].b64_json}` : null);
          if (url) return res.status(200).json({ imageUrl: url, method: 'gpt-image-1' });
        }

        // Log gpt-image-1 error but fall through to DALL-E 3
        if (editData.error) {
          console.error('gpt-image-1 edit failed:', editData.error.message, editData.error.code);
        }
      } catch (editErr) {
        console.error('gpt-image-1 exception:', editErr.message);
      }
    }

    // ── PATH B: empty room OR gpt-image-1 fallback → DALL-E 3 generation ─────
    const productSummary = selectedProducts
      ? Object.values(selectedProducts).map(p => p.dalleDescription || p.name).join(', ')
      : '';

    const dallePrompt = `Professional interior design photography of a renovated ${roomDesc} in ${styleDesc}.${productSummary ? ' Featuring: ' + productSummary + '.' : ''}${adjustments} Bright natural lighting, no people, photorealistic, high quality.`;

    const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: dallePrompt.trim(),
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      })
    });

    const dalleData = await dalleRes.json();
    if (dalleData.error) return res.status(500).json({ error: dalleData.error.message });
    if (!dalleData.data?.[0]?.url) return res.status(500).json({ error: 'No image returned' });

    return res.status(200).json({ imageUrl: dalleData.data[0].url, method: 'dall-e-3' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
