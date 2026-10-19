export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import connectToDb from "@/lib/utils/db";
import Categorie from "@/lib/models/Categorie";
import Quiz from "@/lib/models/Quiz";
import Player from "@/lib/models/Player";
import Partie from "@/lib/models/Partie";

/**
 * Vérifie le header Authorization: Bearer <CLAUDE_WEBHOOK_SECRET>.
 * Retourne une NextResponse d'erreur si invalide, null si valide.
 */
function checkAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CLAUDE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Service non configuré : CLAUDE_WEBHOOK_SECRET absent." },
      { status: 503 }
    );
  }
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Non autorisé." },
      { status: 401 }
    );
  }
  return null;
}

/**
 * GET — health check + stats rapides.
 */
export async function GET(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    await connectToDb();

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [categories, questions, players, partiesAujourdhui, inscritsAujourdhui] =
      await Promise.all([
        Categorie.countDocuments(),
        Quiz.countDocuments(),
        Player.countDocuments(),
        Partie.countDocuments({ createdAt: { $gte: startOfDay } }),
        Player.countDocuments({ createdAt: { $gte: startOfDay } }),
      ]);

    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
      stats: {
        categories,
        questions,
        players,
        partiesAujourdhui,
        inscritsAujourdhui,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CLAUDE ADMIN] GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST — actions d'administration.
 * Body JSON attendu : { "action": "...", ...params }
 */
export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (!body || typeof body.action !== "string") {
    return NextResponse.json(
      { error: "Champ `action` manquant ou invalide." },
      { status: 400 }
    );
  }

  try {
    await connectToDb();

    switch (body.action) {
      // ─── seed_categories ────────────────────────────────────────────────────
      case "seed_categories": {
        if (!Array.isArray(body.categories) || body.categories.length === 0) {
          return NextResponse.json(
            { error: "Champ `categories` requis (tableau non vide)." },
            { status: 400 }
          );
        }

        type CategoryInput = { designation: string; description?: string; slug: string };
        const created: string[] = [];
        const skipped: string[] = [];

        for (const cat of body.categories as CategoryInput[]) {
          if (!cat.slug || !cat.designation) {
            skipped.push(cat.slug ?? "(slug manquant)");
            continue;
          }
          const exists = await Categorie.exists({ slug: cat.slug });
          if (exists) {
            skipped.push(cat.slug);
          } else {
            await Categorie.create({
              designation: cat.designation,
              description: cat.description ?? "",
              slug: cat.slug,
            });
            created.push(cat.slug);
          }
        }

        return NextResponse.json({ created, skipped });
      }

      // ─── seed_questions ─────────────────────────────────────────────────────
      case "seed_questions": {
        const { categorieSlug, questions } = body as {
          categorieSlug?: string;
          questions?: unknown[];
        };

        if (!categorieSlug) {
          return NextResponse.json(
            { error: "Champ `categorieSlug` requis." },
            { status: 400 }
          );
        }
        if (!Array.isArray(questions) || questions.length === 0) {
          return NextResponse.json(
            { error: "Champ `questions` requis (tableau non vide)." },
            { status: 400 }
          );
        }

        const categorie = await Categorie.findOne({ slug: categorieSlug }).lean();
        if (!categorie) {
          return NextResponse.json(
            { error: `Catégorie introuvable : ${categorieSlug}` },
            { status: 404 }
          );
        }

        type QuestionInput = {
          enonce: string;
          assertions: string[];
          reponse: string;
          level?: 0 | 1 | 2 | 3;
          type?: "QCM" | "VRAI_FAUX";
        };

        const docs = (questions as QuestionInput[]).map((q) => ({
          categorieId: categorie._id,
          enonce: q.enonce,
          assertions: q.assertions,
          reponse: q.reponse,
          level: q.level ?? 0,
          type: q.type ?? "QCM",
        }));

        let inserted = 0;
        let errors = 0;
        try {
          const result = await Quiz.insertMany(docs, { ordered: false });
          inserted = result.length;
        } catch (bulkErr: unknown) {
          // MongoBulkWriteError (ordered:false) : des docs ont été insérés malgré l'erreur.
          if (bulkErr instanceof Error && "result" in bulkErr) {
            const r = (bulkErr as { result: { insertedCount?: number } }).result;
            inserted = r.insertedCount ?? 0;
            errors = docs.length - inserted;
          } else {
            throw bulkErr;
          }
        }

        return NextResponse.json({ inserted, errors });
      }

      // ─── list_categories ────────────────────────────────────────────────────
      case "list_categories": {
        const cats = await Categorie.find().lean();

        const categoriesWithCount = await Promise.all(
          cats.map(async (cat) => ({
            _id: cat._id,
            designation: cat.designation,
            slug: cat.slug,
            description: cat.description ?? "",
            questionCount: await Quiz.countDocuments({ categorieId: cat._id }),
          }))
        );

        return NextResponse.json({ categories: categoriesWithCount });
      }

      // ─── delete_category ────────────────────────────────────────────────────
      case "delete_category": {
        const { slug } = body as { slug?: string };
        if (!slug) {
          return NextResponse.json(
            { error: "Champ `slug` requis." },
            { status: 400 }
          );
        }

        const categorie = await Categorie.findOne({ slug }).lean();
        if (!categorie) {
          return NextResponse.json(
            { error: `Catégorie introuvable : ${slug}` },
            { status: 404 }
          );
        }

        const [deletedQuestions, deletedCategorie] = await Promise.all([
          Quiz.deleteMany({ categorieId: categorie._id }),
          Categorie.deleteOne({ _id: categorie._id }),
        ]);

        return NextResponse.json({
          deleted: {
            categorie: deletedCategorie.deletedCount,
            questions: deletedQuestions.deletedCount,
          },
        });
      }

      // ─── action inconnue ────────────────────────────────────────────────────
      default:
        return NextResponse.json(
          { error: `Action inconnue : ${body.action}` },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CLAUDE ADMIN] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Méthodes non prises en charge
export async function PUT() {
  return NextResponse.json(
    { error: "Méthode non autorisée." },
    { status: 405, headers: { Allow: "GET, POST" } }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Méthode non autorisée." },
    { status: 405, headers: { Allow: "GET, POST" } }
  );
}

