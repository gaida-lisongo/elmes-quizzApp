"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Upload, FileText, Loader2, CheckCircle, AlertCircle,
  ChevronRight, ArrowLeft, FileUp, Settings, BarChart3,
} from "lucide-react";
import { createQuizzesBulkAction } from "@/actions/quiz.actions";

const LEVEL_MAP: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3,
  niveau0: 0, niveau1: 1, niveau2: 2, niveau3: 3,
};

interface CsvWrapperProps {
  categorieId: string;
  onClose: () => void;
  onComplete: () => void;
}

interface CsvRow {
  enonce: string;
  assertions: string[];
  reponse: string;
  level: number;
  type: "QCM" | "VRAI_FAUX";
}

type Step = "config" | "loading" | "summary";

export default function CsvWrapper({ categorieId, onClose, onComplete }: CsvWrapperProps) {
  const [step, setStep] = useState<Step>("config");
  const [separator, setSeparator] = useState(";");
  const [hasHeader, setHasHeader] = useState(true);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ count: number; errors: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        // Parse CSV manuellement (sans dépendance csv-parse)
        const allLines = content.split(/\r?\n/).filter(line => line.trim());
        const records: string[][] = allLines.map(line => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              inQuotes = !inQuotes;
            } else if (ch === separator && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += ch;
            }
          }
          result.push(current.trim());
          return result;
        });

        if (!records || records.length === 0) {
          setError("Le fichier est vide.");
          return;
        }

        let startIndex = 0;
        let detectedHeaders: string[] = [];
        if (hasHeader) {
          detectedHeaders = records[0];
          setHeaders(detectedHeaders);
          startIndex = 1;
        } else {
          detectedHeaders = records[0].map((_, i) => `Colonne ${i + 1}`);
          setHeaders(detectedHeaders);
        }

        const parsed: CsvRow[] = [];
        for (let i = startIndex; i < records.length; i++) {
          const rec = records[i];
          if (rec.length < 3) continue;

          const enonce = rec[0]?.trim() || "";
          if (!enonce) continue;

          const rawType = rec[rec.length - 1]?.trim() || "QCM";
          const rawLevel = rec[rec.length - 2]?.trim() || "0";
          const reponse = rec[rec.length - 3]?.trim() || "";
          const assertionCells = rec.slice(1, Math.max(1, rec.length - 3));

          const assertions = assertionCells
            .map((value) => value.trim())
            .filter(Boolean);
          const level = LEVEL_MAP[rawLevel.toLowerCase()] ?? 0;
          const type = rawType.toUpperCase() === "VRAI_FAUX" ? "VRAI_FAUX" : "QCM";

          parsed.push({ enonce, assertions, reponse, level, type });
        }

        if (parsed.length === 0) {
          setError("Aucune ligne valide trouvée. Vérifiez le format (énoncé, option1, option2, ..., réponse, niveau, type).");
          return;
        }

        setRows(parsed);
        setStep("loading");
      } catch (err: any) {
        setError("Erreur de lecture: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    setError(null);

    const batchSize = 20;
    const totalBatches = Math.ceil(rows.length / batchSize);
    let totalCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < totalBatches; i++) {
      const batch = rows.slice(i * batchSize, (i + 1) * batchSize);
      const payload = batch.map(r => ({
        categorieId,
        enonce: r.enonce,
        assertions: r.assertions,
        reponse: r.reponse,
        level: r.level,
        type: r.type,
      }));

      try {
        const res = await createQuizzesBulkAction(payload);
        if (res.success) {
          totalCount += res.count || payload.length;
        } else {
          errors.push(`Lot ${i + 1}: ${res.error}`);
        }
      } catch (err: any) {
        errors.push(`Lot ${i + 1}: ${err.message}`);
      }

      setProgress(Math.round(((i + 1) / totalBatches) * 100));
    }

    setResult({ count: totalCount, errors });
    setImporting(false);
    setStep("summary");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white shadow-solid-4 dark:bg-blacksection">
        
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stroke bg-white px-6 py-4 dark:border-strokedark dark:bg-blacksection">
          <div className="flex items-center gap-3">
            <FileUp className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-lg font-bold text-black dark:text-white">Import CSV</h3>
              <p className="text-xs text-waterloo">Import en masse de questions</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-stroke dark:hover:bg-strokedark">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Stepper */}
          {["config", "loading", "summary"].includes(step) && (
            <div className="mb-6 flex items-center gap-2">
              {[
                { key: "config", num: 1, label: "Config" },
                { key: "loading", num: 2, label: "Chargement" },
                { key: "summary", num: 3, label: "Résumé" },
              ].map((s, i) => (
                <div key={s.key} className="flex items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    step === s.key ? "bg-primary text-white" :
                    ["loading", "summary"].includes(step) && i <= ["config", "loading", "summary"].findIndex(x => x === step)
                      ? "bg-meta text-white" : "bg-stroke text-manatee dark:bg-strokedark"
                  }`}>{s.num}</div>
                  <span className="text-xs text-waterloo">{s.label}</span>
                  {i < 2 && <div className={`h-0.5 w-6 ${i < 1 ? "bg-meta" : "bg-stroke dark:bg-strokedark"}`} />}
                </div>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Config */}
            {step === "config" && (
              <motion.div key="config" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="flex items-center gap-2 text-waterloo">
                  <Settings className="h-4 w-4" />
                  <h4 className="font-medium text-black dark:text-white">Configuration</h4>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Séparateur de colonnes</label>
                  <div className="flex gap-2">
                    {[",", ";", "\t", "|"].map(sep => (
                      <button key={sep} onClick={() => setSeparator(sep)}
                        className={`flex-1 rounded-lg border px-4 py-2 text-sm transition ${
                          separator === sep
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-stroke text-waterloo hover:border-primary dark:border-strokedark"
                        }`}>
                        {sep === "\t" ? "Tab" : `"${sep}"`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="hasHeader" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)}
                    className="h-4 w-4 rounded border-stroke text-primary focus:ring-primary" />
                  <label htmlFor="hasHeader" className="text-sm text-black dark:text-white">Première ligne = en-têtes</label>
                </div>

                <div className="rounded-xl border border-dashed border-stroke bg-alabaster p-6 text-center dark:border-strokedark dark:bg-strokedark">
                  <FileText className="mx-auto h-8 w-8 text-waterloo/40" />
                  <p className="mt-2 text-sm text-waterloo">Format attendu :</p>
                  <code className="mt-1 block text-xs text-waterloo/60">
                    énoncé{separator}option1{separator}option2{separator}...{separator}réponse{separator}niveau{separator}type
                  </code>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <button onClick={() => inputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho">
                      <Upload className="h-4 w-4" /> Charger un fichier
                    </button>
                    <button onClick={() => {
                      const header = `énoncé${separator}option1${separator}option2${separator}option3${separator}option4${separator}réponse${separator}niveau${separator}type`;
                      const sample = `Quelle est la capitale de la France ?${separator}Paris${separator}Londres${separator}Berlin${separator}Madrid${separator}Paris${separator}0${separator}QCM\nLe Soleil est une étoile.${separator}Vrai${separator}Faux${separator}Vrai${separator}Faux${separator}Vrai${separator}1${separator}VRAI_FAUX`;
                      const bom = "\uFEFF";
                      const blob = new Blob([bom + header + "\n" + sample], { type: "text/csv;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = "template_questions.csv"; a.click();
                      URL.revokeObjectURL(url);
                    }}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-stroke px-4 py-2 text-sm text-waterloo transition hover:bg-stroke dark:border-strokedark dark:hover:bg-strokedark">
                      <FileText className="h-4 w-4" /> Télécharger le template
                    </button>
                  </div>
                  <input ref={inputRef} type="file" accept=".csv,.txt" onChange={handleFileLoad} className="hidden" />
                </div>

                {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
              </motion.div>
            )}

            {/* Loading / Import progress */}
            {step === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="flex items-center gap-2 text-waterloo">
                  <BarChart3 className="h-4 w-4" />
                  <h4 className="font-medium text-black dark:text-white">Import en cours</h4>
                </div>

                <div className="rounded-xl border border-stroke p-6 text-center dark:border-strokedark">
                  {importing ? (
                    <>
                      <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                      <p className="mt-4 font-medium text-black dark:text-white">
                        Import de {rows.length} question(s)...
                      </p>
                      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-stroke dark:bg-strokedark">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-waterloo">{progress}%</p>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
                      <p className="mt-4 font-medium text-black dark:text-white">Prêt à importer</p>
                      <p className="mt-1 text-sm text-waterloo">{rows.length} ligne(s) détectée(s)</p>
                      <button onClick={handleImport}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm text-white transition hover:bg-primaryho">
                        Démarrer l'import <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>

                {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
              </motion.div>
            )}

            {/* Summary */}
            {step === "summary" && result && (
              <motion.div key="summary" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4">
                <div className="flex items-center gap-2 text-waterloo">
                  <CheckCircle className="h-4 w-4" />
                  <h4 className="font-medium text-black dark:text-white">Résumé</h4>
                </div>

                <div className="rounded-xl border border-stroke p-6 text-center dark:border-strokedark">
                  {result.errors.length === 0 ? (
                    <>
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        <CheckCircle className="h-7 w-7 text-green-600" />
                      </div>
                      <h4 className="mt-4 text-lg font-bold text-black dark:text-white">Import réussi !</h4>
                      <p className="mt-2 text-sm text-waterloo">{result.count} question(s) importée(s)</p>
                    </>
                  ) : (
                    <>
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                        <AlertCircle className="h-7 w-7 text-yellow-600" />
                      </div>
                      <h4 className="mt-4 text-lg font-bold text-black dark:text-white">Import partiel</h4>
                      <p className="mt-2 text-sm text-waterloo">{result.count} question(s) importée(s)</p>
                      <div className="mt-3 space-y-1 text-left">
                        {result.errors.map((err, i) => (
                          <p key={i} className="text-xs text-red-500">{err}</p>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={onComplete}
                    className="flex-1 rounded-xl bg-primary py-3 font-medium text-white transition hover:bg-primaryho">
                    Fermer
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}