/**
 * Convertit une chaîne LaTeX pure en notation compatible avec KaTeX
 * (c'est-à-dire encadrée par `$...$` ou `$$...$$` pour les block).
 *
 * Fonctionne pour:
 * - Les expressions inline déjà entre \( ... \)
 * - Les expressions display entre \[ ... \]
 * - Les expressions simples sans délimiteurs (par ex. \frac{a}{b}) -> les entoure de $
 * - Garde le texte non‑mathématique intact.
 */
export function convertPureLaTeXToKaTeX(latex: string): string {
  if (!latex) return "";
  
  // Étape 1: remplacer les séquences \( ... \) par $ ... $
  let result = latex.replace(/\\\(([^)]+)\\\)/g, (_, inner) => `$${inner}$`);
  
  // Étape 2: remplacer les séquences \[ ... \] par $$ ... $$
  result = result.replace(/\\\[([^\]]+)\\\]/g, (_, inner) => `$$${inner}$$`);
  
  // Étape 3: détecter les commandes LaTeX isolées (ex: \frac{a}{b} ou \sin x) et les entourer de $
  // Cette regex détecte \command{...} ou \command sans espace immédiatement après
  const latexCmdRegex = /\\(?:[a-zA-Z]+(?:\{[^}]*\})*|[^a-zA-Z])/g;
  
  // On parcourt le texte restant et on entoure chaque commande LaTeX de $...$
  // mais seulement si ce n'est pas déjà dans un environnement $...$ ou $$...$$
  const parts = result.split(/(\$[^$]+\$|\$\$[^$]+\$\$)/);
  
  const processedParts = parts.map(part => {
    if (part.startsWith('$') && part.endsWith('$')) {
      // Déjà dans un environnement KaTeX => on laisse tel quel
      return part;
    }
    // Pas dans un délimiteur KaTeX, on cherche les commandes LaTeX
    // On insère $ avant chaque commande et après, mais seulement si elle n'est pas déjà dans un $...$
    // On utilise une approche plus simple: entourer chaque occurrence de \... d'un $ si elle n'est pas déjà dans un bloc math.
    let temp = part;
    temp = temp.replace(/(\\[a-zA-Z]+(?:\{[^}]*\})*|[^$]\\[^a-zA-Z])/g, (match) => {
      // Si le match commence par \ et n'est pas déjà précédé d'un $ qui ferait partie d'un bloc KaTeX
      return `$${match}$`;
    });
    return temp;
  });
  
  return processedParts.join('').replace(/\$\$/g, '$$'); // nettoyer les doubles $$
}

/**
 * Affiche un aperçu LaTeX directement dans une zone de texte ou un div
 * en utilisant KaTeX pour le rendu.
 */
export function renderLaTeXPreview(elementId: string, latex: string): void {
  if (typeof window === 'undefined') return;
  
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const katex = (window as any).katex;
  if (!katex) {
    console.warn("KaTeX n'est pas chargé");
    return;
  }
  
  try {
    const converted = convertPureLaTeXToKaTeX(latex);
    // On nettoie les $$ superflus
    const final = converted.replace(/\$\$\$/g, '$$').replace(/\$\$/g, '$$');
    
    element.innerHTML = '';
    // On split par bloc $$...$$ pour traiter séparément les display math
    const displayBlocks = final.split(/(\$\$[^$]+\$\$)/g);
    
    displayBlocks.forEach(block => {
      if (block.startsWith('$$') && block.endsWith('$$')) {
        const mathContent = block.slice(2, -2);
        const span = document.createElement('span');
        span.style.display = 'block';
        span.style.textAlign = 'center';
        span.style.margin = '1em 0';
        katex.render(mathContent, span, { displayMode: true });
        element.appendChild(span);
      } else {
        // Traiter le reste comme un mélange de texte et de maths inline
        const inlineParts = block.split(/(\$[^$]+\$)/g);
        inlineParts.forEach(part => {
          if (part.startsWith('$') && part.endsWith('$')) {
            const mathContent = part.slice(1, -1);
            const span = document.createElement('span');
            katex.render(mathContent, span, { displayMode: false });
            element.appendChild(span);
          } else {
            const textNode = document.createTextNode(part);
            element.appendChild(textNode);
          }
        });
      }
    });
  } catch (error) {
    console.error("Erreur rendu KaTeX:", error);
    element.textContent = latex;
  }
}