import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import connectToDb from "@/lib/utils/db";
import Equipe from "@/lib/models/Equipe";
import EnrollementModel from "@/lib/models/Enrollement";

const BANNER_IMAGE = "/images/team/team-2.jpg";

export const metadata = {
  title: "ELMES-QUIZ | Équipe",
  description: "Profil détaillé d’une équipe sur ELMES-QUIZ.",
};

export default async function EquipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await connectToDb();
  const equipe = await Equipe.findById(id)
    .populate({ path: "chefId", populate: { path: "userId", select: "pseudo photo telephone" } })
    .lean();

  if (!equipe) {
    notFound();
  }

  const enrollements = await EnrollementModel.Enrollement.find({ equipeId: equipe._id })
    .populate({ path: "competitionId", select: "designation slug image" })
    .populate({ path: "sessionId", select: "designation slug startDate endDate" })
    .sort({ createdAt: -1 })
    .lean();

  const members = (equipe.membres || []).map((member: any) => ({
    id: member.player?.toString?.() || "",
    status: Boolean(member.status),
    isSecretary: Boolean(member.isSecretary),
  }));

  return (
    <main className="pb-20 pt-28 lg:pt-32">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 h-72 bg-black">
          <Image src={BANNER_IMAGE} alt={equipe.designation} fill className="object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/70" />
        </div>

        <div className="relative mx-auto max-w-c-1280 px-4 pt-20 md:px-8 xl:px-0">
          <div className="rounded-[32px] border border-white/10 bg-white/90 p-6 shadow-solid-8 backdrop-blur dark:border-strokedark dark:bg-blacksection/90 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-white shadow-solid-8 dark:border-blacksection">
                  {equipe.logo ? (
                    <Image src={equipe.logo} alt={equipe.designation} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary/10 text-3xl font-semibold text-primary">
                      {equipe.designation?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                    {equipe.metriques?.competitions || 0} compétitions
                  </div>
                  <h1 className="mt-3 text-3xl font-semibold text-black dark:text-white">{equipe.designation}</h1>
                  <p className="mt-2 text-sm text-waterloo">Capitaine : {equipe.chefId?.userId?.pseudo || "À définir"}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-stroke bg-alabaster px-4 py-3 text-sm text-waterloo dark:border-strokedark dark:bg-strokedark">
                <div className="font-semibold text-black dark:text-white">Métriques</div>
                <div className="mt-1 flex gap-4">
                  <span>{equipe.metriques?.matchsWin || 0} victoires</span>
                  <span>{equipe.metriques?.soldeUsd || 0} USD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-c-1280 px-4 md:px-8 xl:px-0">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="space-y-6">
            <div className="rounded-3xl border border-stroke bg-white p-6 shadow-solid-8 dark:border-strokedark dark:bg-blacksection">
              <h2 className="text-xl font-semibold text-black dark:text-white">À propos</h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-waterloo whitespace-pre-line">
                {(equipe.description || []).map((line: string, index: number) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-stroke bg-white p-6 shadow-solid-8 dark:border-strokedark dark:bg-blacksection">
              <h2 className="text-xl font-semibold text-black dark:text-white">Membres</h2>
              <div className="mt-4 space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-2xl bg-alabaster px-4 py-3 dark:bg-strokedark">
                    <div>
                      <p className="font-medium text-black dark:text-white">Membre #{member.id.slice(-4)}</p>
                      <p className="text-sm text-waterloo">{member.isSecretary ? "Secrétaire" : "Membre"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${member.status ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {member.status ? "Actif" : "En attente"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <div className="rounded-3xl border border-stroke bg-white p-6 shadow-solid-8 dark:border-strokedark dark:bg-blacksection">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-black dark:text-white">Enrôlements</h2>
                <Link href="/equipes" className="text-sm font-medium text-primary">Retour aux équipes</Link>
              </div>
              <div className="mt-6 space-y-4">
                {enrollements.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stroke p-6 text-center text-sm text-waterloo dark:border-strokedark">
                    Cette équipe n’a pas encore d’enrôlement.
                  </div>
                ) : (
                  enrollements.map((enrollement: any) => (
                    <div key={enrollement._id} className="rounded-2xl border border-stroke bg-alabaster p-4 dark:border-strokedark dark:bg-strokedark">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-black dark:text-white">{enrollement.competitionId?.designation || "Compétition"}</h3>
                          <p className="text-sm text-waterloo">Session : {enrollement.sessionId?.designation || "À définir"}</p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{enrollement.status}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-waterloo">
                        <span>Code : {enrollement.code}</span>
                        <span>Parties : {enrollement.parties}</span>
                        <span>Commande : {enrollement.orderNumber}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
