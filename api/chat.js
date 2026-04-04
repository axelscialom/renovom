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
1. Fais un résumé enthousiaste de ses choix en 2 phrases max
2. Pose immédiatement UNE seule question courte pour affiner le projet (ex: "Tu as une couleur de mur en tête ?" ou "La pièce est bien éclairée naturellement ?")

Si la conversation est en cours :
- Réponds brièvement à ce que dit l'utilisateur (1 phrase)
- Pose UNE nouvelle question courte pour affiner davantage (couleurs, luminosité, contraintes, meubles existants à garder)
- Ne propose JAMAIS de générer une image ou une visualisation — c'est géré automatiquement par l'application
- Maximum 3 phrases par réponse au total

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
