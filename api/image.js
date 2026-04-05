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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { room, style, photo, roomType, selectedProducts = {}, refinementNote = '' } = req.body || {};
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY manquante' });

  const styleDesc = styleMap[style] || 'modern interior';
  const roomDesc = roomMap[room] || 'room';

  // Build product context from dalleDescription fields
  const productLines = Object.entries(selectedProducts)
    .map(([elName, p]) => p.dalleDescription || p.name)
    .filter(Boolean);
  const productContext = productLines.length > 0 ? `featuring: ${productLines.join(', ')}` : '';
  const refinementContext = refinementNote ? ` Additional adjustment: ${refinementNote}.` : '';

  // ── Path A: gpt-image-1 editing (furnished room + photo) ──────────────────
  if (photo && roomType === 'meuble') {
    try {
      const base64 = photo.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64, 'base64');
      const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

      const editPrompt = [
        `Transform this ${roomDesc} into a ${styleDesc} style interior.`,
        productContext ? `Update the furniture and decor ${productContext}.` : '',
        'Keep the original room architecture, floor plan, windows, and walls intact.',
        'Make it look like a professional interior design photography.',
        refinementContext
      ].filter(Boolean).join(' ');

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
      if (editData.error) throw new Error(editData.error.message);

      const b64 = editData.data?.[0]?.b64_json;
      if (!b64) throw new Error('No image returned from gpt-image-1');

      return res.status(200).json({
        imageUrl: `data:image/png;base64,${b64}`,
        method: 'gpt-image-1'
      });
    } catch (e) {
      // Fall through to DALL-E 3
    }
  }

  // ── Path B: DALL-E 3 (empty room, no photo, or gpt-image-1 fallback) ──────
  try {
    const prompt = [
      `Interior design photo of a beautifully renovated ${roomDesc}.`,
      `Style: ${styleDesc}.`,
      productContext ? `The room features ${productContext}.` : '',
      'Professional interior photography, natural lighting, no people, photorealistic, wide angle shot.',
      refinementContext
    ].filter(Boolean).join(' ');

    const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      })
    });

    const dalleData = await dalleRes.json();
    if (dalleData.error) return res.status(500).json({ error: dalleData.error.message });

    return res.status(200).json({ imageUrl: dalleData.data[0].url, method: 'dall-e-3' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
