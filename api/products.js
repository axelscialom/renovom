export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { elements, style, budget } = req.body;
    // elements: array of { name, icon }

    const budgetDesc = {
      'Moins de 500€':    'très petit budget — produits sous 80€ pièce',
      '500 – 1 500€':    'budget intermédiaire — produits entre 20€ et 400€',
      '1 500 – 5 000€':  'bon budget — produits entre 60€ et 900€',
      '+ 5 000€':         'budget premium — produits haut de gamme'
    }[budget] || 'budget intermédiaire';

    const styleHints = {
      'Scandinave':    'bois clair, blanc cassé, lin naturel, épuré, minimaliste chaleureux',
      'Industriel':    'métal noir mat, béton, Edison, acier brossé, loft brut',
      'Bohème':        'rotin, bambou, terracotta, plantes, textiles superposés, esprit libre',
      'Vintage':       'velours, laiton doré, rétro mid-century, patine, courbes douces',
      'Contemporain':  'marbre, noir et blanc, lignes géométriques nettes, luxe discret'
    }[style] || 'moderne';

    const elementNames = elements.map(e => e.name).join(', ');

    const systemPrompt = `Tu es expert en décoration intérieure et en produits disponibles dans les enseignes françaises (Leroy Merlin, IKEA, Castorama, Maisons du Monde, La Redoute, Brico Dépôt).
Tu réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après.`;

    const userPrompt = `Style: ${style} (${styleHints})
Budget: ${budgetDesc}

Pour CHAQUE élément listé, propose EXACTEMENT 3 produits réels et différents.
Les 3 produits d'un même élément doivent couvrir 3 gammes de prix (économique, milieu, premium).
Éléments à traiter: ${elementNames}

Format JSON obligatoire (les clés doivent correspondre exactement aux noms des éléments):
{
  "${elements[0]?.name || 'Peinture murale'}": [
    {
      "name": "Nom précis du produit tel que vendu en magasin",
      "store": "Leroy Merlin",
      "price": 29.90,
      "icon": "🎨",
      "iconBg": "#F5F0E8",
      "delivery": "Livraison gratuite dès 25€ · Click & Collect disponible",
      "description": "Description courte en une phrase",
      "dalleDescription": "brief English description for image generation, e.g. 'matte white wall paint'"
    },
    { ... produit 2 ... },
    { ... produit 3 ... }
  ]
}

Règles:
- Noms précis, reconnaissables
- Prix réalistes pour ${budgetDesc}
- iconBg: couleur hex douce cohérente avec style ${style}
- Livraison réaliste par enseigne:
  Leroy Merlin: "Livraison gratuite dès 25€ · Click & Collect disponible"
  IKEA: "Click & Collect gratuit · Livraison à domicile dès 49€"
  Castorama: "Livraison sous 3-5 jours · Click & Collect 2h"
  Maisons du Monde: "Livraison à domicile · Retrait en magasin offert"
  La Redoute: "Livraison gratuite dès 60€ · Retour 30 jours offert"
  Brico Dépôt: "Livraison sous 48h · Click & Collect disponible"
- dalleDescription: courte description en anglais pour générer une image réaliste`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.content[0].text.trim();
    let products;

    try {
      products = JSON.parse(text);
    } catch (e) {
      const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const rawJson = text.match(/(\{[\s\S]*\})/);
      const src = codeBlock ? codeBlock[1] : rawJson ? rawJson[1] : null;
      if (src) products = JSON.parse(src);
      else throw new Error('Cannot parse products JSON');
    }

    return res.status(200).json({ products });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
