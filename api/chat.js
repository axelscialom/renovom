export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, room, budget, style } = req.body;

    const isFirstMessage = !messages || messages.length === 0;

    const systemPrompt = `Tu es un designer intérieur expert et chaleureux pour Renovom.
L'utilisateur veut rénover sa ${room} avec un budget ${budget} en style ${style}.

Si c'est le début de la conversation :
1. Fais un résumé friendly et enthousiaste de ses choix (pièce, budget, style)
2. Annonce que tu vas lui proposer une vision personnalisée de sa pièce rénovée
3. Pose-lui 1 question courte pour commencer à affiner le projet (ex: couleur des murs, luminosité)

Si la conversation est en cours :
- Pose des questions courtes pour affiner le projet (couleur des murs, contraintes, luminosité)
- Maximum 2 phrases par réponse
- Reste toujours chaleureux et professionnel

Rappel du contexte : pièce = ${room}, budget = ${budget}, style = ${style}.
Réponds toujours en français.`;

    const firstMsg = `Je veux rénover ma ${room}. Mon budget est ${budget} et je veux un style ${style}.`;

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
        system: systemPrompt,
        messages: isFirstMessage ? [{ role: 'user', content: firstMsg }] : messages
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
