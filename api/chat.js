export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, room, budget, style } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: 'Tu es un designer intérieur expert pour Renovom. Réponds en français, maximum 2 phrases courtes.',
        messages: messages && messages.length > 0 ? messages : [{ role: 'user', content: 'Bonjour, démarre la conversation.' }]
      })
    });

    const data = await response.json();

    if(data.error) {
      return res.status(500).json({ reply: 'Erreur API: ' + data.error.message });
    }

    res.status(200).json({ reply: data.content[0].text });

  } catch (error) {
    res.status(500).json({ reply: 'Erreur: ' + error.message });
  }
}
