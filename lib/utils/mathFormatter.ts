/**
 * Nettoie une chaîne brute contenant des expressions mathématiques LaTeX
 * avant de la passer au rendu KaTeX.
 *
 * Corrections appliquées :
 * - `\,` (espace fine échappée) → `, ` (virgule + espace standard)
 * - `\\sin`, `\\cos`, `\\lim`, etc. → `\sin`, `\cos`, `\lim` (double backslash → simple)
 * - `\\(` et `\\)` (délimiteurs LaTeX échappés) → `$` (délimiteurs KaTeX)
 * - Espaces multiples → un seul espace
 * - Trim
 */
export function formatMathString(rawText: string): string {
  if (!rawText) return "";

  let result = rawText;
  
  // 1. Remplacer les virgules échappées \, par " " (espace simple, pas de virgule)
  // Mais seulement si ce n'est pas dans un contexte mathématique déjà encapsulé
  result = result.replace(/\\,/g, " ");
  
  // 2. Remplacer les doubles backslash devant une commande (\\sin → \sin)
  result = result.replace(/\\{2,}([a-zA-Z]+)/g, "\\$1");
  
  // 3. Remplacer \( et \) (délimiteurs LaTeX inline) par $
  result = result.replace(/\\\(/g, "$");
  result = result.replace(/\\\)/g, "$");
  
  // 4. Remplacer \[ et \] (délimiteurs LaTeX display) par $$
  result = result.replace(/\\\[/g, "$$");
  result = result.replace(/\\\]/g, "$$");
  
  // 5. Convertir les environnements LaTeX courants en format KaTeX
  // \displaylines{...} → $$\begin{aligned}...\end{aligned}$$
  // Solution simple: juste wrapper dans aligned, laisser KaTeX parser le contenu
  while (result.includes('\\displaylines{')) {
    const startIdx = result.indexOf('\\displaylines{');
    const braceStart = startIdx + '\\displaylines{'.length;
    
    // Trouver l'accolade fermante correspondante (gère les accolades imbriquées)
    let depth = 1;
    let endIdx = braceStart;
    while (depth > 0 && endIdx < result.length) {
      if (result[endIdx] === '{') depth++;
      else if (result[endIdx] === '}') depth--;
      endIdx++;
    }
    
    if (depth === 0) {
      const content = result.slice(braceStart, endIdx - 1);
      // Remplacer \\ par \\newline pour KaTeX
      const processedContent = content.replace(/\\\\/g, '\\\\');
      const replacement = `$$\\begin{aligned}${processedContent}\\end{aligned}$$`;
      result = result.slice(0, startIdx) + replacement + result.slice(endIdx);
    } else {
      break;
    }
  }
  
  // \begin{align}...\end{align} → \begin{aligned}...\end{aligned}
  result = result.replace(/\\begin\{align\}([\s\S]*?)\\end\{align\}/g, (match, content) => {
    return `$$\\begin{aligned}${content}\\end{aligned}$$`;
  });
  
  // \begin{equation}...\end{equation} → $$...$$
  result = result.replace(/\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g, (match, content) => {
    return `$$${content}$$`;
  });
  
  // 6. Encapsuler automatiquement les commandes mathématiques isolées dans $
  // Si le texte contient des commandes LaTeX comme \int, \frac, \sum, etc.
  // et n'est pas déjà encapsulé dans $, on l'encapsule
  
  // Liste des commandes mathématiques courantes qui indiquent du LaTeX math
  const mathCommands = [
    '\\int', '\\sum', '\\prod', '\\frac', '\\sqrt', '\\lim', '\\infty',
    '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\theta', '\\lambda',
    '\\pi', '\\sigma', '\\phi', '\\omega', '\\Gamma', '\\Delta', '\\Theta',
    '\\Lambda', '\\Pi', '\\Sigma', '\\Phi', '\\Omega',
    '\\sin', '\\cos', '\\tan', '\\log', '\\ln', '\\exp',
    '\\leq', '\\geq', '\\neq', '\\approx', '\\equiv', '\\pm', '\\times',
    '\\cdot', '\\div', '\\subset', '\\supset', '\\in', '\\notin', '\\forall',
    '\\exists', '\\nexists', '\\Rightarrow', '\\Leftarrow', '\\rightarrow', '\\leftarrow',
    '\\vec', '\\hat', '\\bar', '\\tilde', '\\dot', '\\ddot',
    '\\mathrm', '\\text', '\\mathbf', '\\mathcal', '\\mathbb',
    '\\left', '\\right', '\\begin', '\\end'
  ];
  
  // Vérifier si le texte contient des commandes mathématiques
  const hasMathCommand = mathCommands.some(cmd => result.includes(cmd));
  
  // Si le texte contient des commandes math et n'est pas déjà encapsulé dans $
  // ET ne commence pas déjà par $ ou $$
  if (hasMathCommand && !result.includes('$')) {
    // Encapsuler tout le texte dans $$
    result = `$$${result}$$`;
  }
  
  return result.trim();
}