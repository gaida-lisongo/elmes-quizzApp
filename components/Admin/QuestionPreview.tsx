"use client";

import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/* ================================================================
   Détecte si un texte contient du LaTeX ($$...$$  ou  $...$)
   ================================================================ */
function containsLatex(text: string): boolean {
  return /\$\$[^$]+\$\$|\$[^$]+\$/.test(text);
}

/* ================================================================
   Rend le texte avec support LaTeX réel via KaTeX.
   ================================================================ */
function renderLatexContent(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\$\$[^$]+\$\$|\$[^$]+\$|\\\([^\n]+\\\)|\\\[[^\n]+\\\])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const raw = match[1];
    const isBlock = raw.startsWith("$$") || raw.startsWith("\\[");
    const content = raw.startsWith("$$")
      ? raw.slice(2, -2)
      : raw.startsWith("\\[")
      ? raw.slice(2, -2)
      : raw.startsWith("\\(")
      ? raw.slice(2, -2)
      : raw.slice(1, -1);

    const html = katex.renderToString(content, {
      displayMode: isBlock,
      throwOnError: false,
      output: "html",
    });

    parts.push(
      <span
        key={`${match.index}-${match[0].length}`}
        className={isBlock ? "my-2 block overflow-x-auto" : "mx-0.5 inline-block align-middle"}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/* ================================================================
   Props
   ================================================================ */
interface QuestionPreviewProps {
  enonce: string;
  reponse?: string;
  assertions?: string[];
  type?: string;
  level?: number;
  mini?: boolean; // Mode carte réduite
}

/* ================================================================
   Composant QuestionPreview
   ================================================================ */
export default function QuestionPreview({
  enonce,
  reponse,
  assertions = [],
  type,
  level,
  mini = false,
}: QuestionPreviewProps) {
  const hasLatex = containsLatex(enonce);

  if (mini) {
    return <span className={hasLatex ? "text-primary" : ""}>{renderLatexContent(enonce)}</span>;
  }

  return (
    <div className="space-y-3">
      {/* Énoncé */}
      <div className="text-sm leading-relaxed text-black dark:text-white">
        {renderLatexContent(enonce)}
      </div>

      {/* Métadonnées */}
      {!mini && (type || level !== undefined) && (
        <div className="flex items-center gap-2 text-xs text-waterloo">
          {type && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{type}</span>
          )}
          {level !== undefined && (
            <span className="rounded-full bg-alabaster px-2 py-0.5 dark:bg-strokedark">Niveau {level}</span>
          )}
        </div>
      )}

      {/* Assertions */}
      {!mini && assertions.length > 0 && (
        <div className="space-y-1.5">
          {assertions.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                a === reponse
                  ? "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300"
                  : "border-stroke text-waterloo dark:border-strokedark"
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stroke text-[10px] font-medium text-waterloo dark:bg-strokedark">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{renderLatexContent(a)}</span>
              {a === reponse && (
                <span className="ml-auto text-[10px] font-medium text-green-600 dark:text-green-400">
                  ✓ Bonne réponse
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}