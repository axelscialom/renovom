export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { room, style, budget, notes } = req.body;

    const budgetDesc = {
      'Moins de 500€': 'petit budget — privilégier des produits abordables sous 150€ pièce',
      '500 – 1 500€': 'budget intermédiaire — produits qualité/prix entre 20€ et 400€',
      '1 500 – 5 000€': 'bon budget — produits de qualité supérieure entre 50€ et 800€',
      '+ 5 000€': 'budget premium — produits haut de gamme sans limite de prix'
    }[budget] || 'budget intermédiaire';

    const notesContext = notes && notes.length > 0
      ? `\nPrécisions du projet: ${notes.filter(Boolean).join('. ')}`
      : '';

    // Style-specific product hints to guide Claude toward the right aesthetic
    const styleHints = {
      'Scandinave': 'bois clair, blanc cassé, lin naturel, formes épurées, matériaux naturels, chaleureux et minimaliste',
      'Industriel': 'métal noir mat, béton, briques apparentes, Edison bulbs, acier brossé, look loft urbain',
      'Bohème': 'rotin, bambou, terracotta, couleurs chaudes, textiles superposés, plantes, esprit libre et chaleureux',
      'Vintage': 'patine, velours, bois foncé, laiton doré, couleurs douces rétro, mid-century modern',
      'Contemporain': 'lignes épurées, noir et blanc, marbre, verre, métal brossé, luxe discret et géométrique'
    }[style] || 'moderne et fonctionnel';

    const systemPrompt = `Tu es un expert en décoration intérieure et en produits disponibles dans les magasins de bricolage et d'ameublement français.
Tu connais parfaitement les gammes de Leroy Merlin, IKEA, Castorama, Maisons du Monde, La Redoute, Brico Dépôt.
Tu réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après le JSON.`;

    const userPrompt = `Projet de rénovation:
- Pièce: ${room}
- Style souhaité: ${style} (${styleHints})
- Budget: ${budgetDesc}${notesContext}

Génère exactement 5 recommandations produits réels et cohérents pour transformer cette ${room} en style ${style}.

Contraintes obligatoires:
1. Au moins 1 produit de type "Peinture" ou "Revêtement"
2. Au moins 1 produit de type "Mobilier" ou "Meuble"
3. Au moins 1 produit de type "Éclairage"
4. 1 accessoire décoratif cohérent avec le style ${style}
5. 1 élément fonctionnel ou pratique adapté à la ${room}

Magasins autorisés uniquement: Leroy Merlin, IKEA, Castorama, Maisons du Monde, La Redoute, Brico Dépôt

Réponds UNIQUEMENT avec ce JSON (pas de texte avant/après):
{
  "products": [
    {
      "name": "Nom précis du produit tel que vendu en magasin",
      "description": "Description courte et précise en une phrase",
      "category": "Peinture",
      "icon": "🎨",
      "iconBg": "#F5F0E8",
      "store": "Leroy Merlin",
      "price": 29.90,
      "delivery": "Livraison gratuite dès 25€ · Click & Collect disponible",
      "matchReason": "Explication en une phrase du lien avec le style ${style}"
    }
  ]
}

Pour iconBg: utiliser une couleur hex douce et cohérente avec le style ${style}:
- Scandinave: tons sable/crème (#F5F0E8, #F1EFE8, #E8F0F5)
- Industriel: tons gris/ardoise (#2A2A2A, #3A3A4A, #4A4A5A) — fond sombre pour icônes claires
- Bohème: tons chauds/terre (#FAEEDA, #FAECE7, #F5E8D8)
- Vintage: tons rétro (#F8F0E8, #FAECE7, #EDE0D4)
- Contemporain: tons neutres épurés (#F0F0F5, #E8E8F0, #1A1A2E) — fond sombre pour contemporain

Pour delivery: utiliser les formulations réelles de chaque enseigne:
- Leroy Merlin: "Livraison gratuite dès 25€ · Click & Collect disponible"
- IKEA: "Click & Collect gratuit · Livraison à domicile dès 49€"
- Castorama: "Livraison sous 3-5 jours ouvrés · Click & Collect 2h"
- Maisons du Monde: "Livraison à domicile · Retrait en magasin offert"
- La Redoute: "Livraison gratuite dès 60€ · Retour 30 jours offert"
- Brico Dépôt: "Livraison sous 48h · Click & Collect disponible"`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const text = data.content[0].text.trim();

    // Parse JSON, handling potential markdown code blocks
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const rawJson = text.match(/(\{[\s\S]*\})/);
      const src = codeBlock ? codeBlock[1] : rawJson ? rawJson[1] : null;
      if (src) {
        parsed = JSON.parse(src);
      } else {
        throw new Error('Réponse IA non parseable: ' + text.slice(0, 200));
      }
    }

    // Validate structure
    if (!parsed.products || !Array.isArray(parsed.products)) {
      throw new Error('Structure produits invalide');
    }

    return res.status(200).json(parsed);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
