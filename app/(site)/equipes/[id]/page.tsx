import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import connectToDb from "@/lib/utils/db";
import Equipe from "@/lib/models/Equipe";
import EnrollementModel from "@/lib/models/Enrollement";

const BANNER_IMAGE = "/images/team/team-2.jpg";

export const metadata = {
  title: "ELMES-QUIZ | Equipe",
  description: "Profil detaille d'une equipe sur ELMES-QUIZ.",
};

export default async function EquipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await connectToDb();
  const equipe = await Equipe.findById(id)
    .populate({ path: "chefId", populate: { path: "userId", select: "pseudo photo telephone" } })
    .populate({ path: "membres.player", populate: { path: "userId", select: "pseudo photo telephone" } })
    .lean();

  if (!equipe) notFound();

  const enrollements = await EnrollementModel.Enrollement.find({ equipeId: equipe._id })
    .populate({ path: "competitionId", select: "designation slug image cagnotte" })
    .populate({ path: "sessionId", select: "designation slug startDate endDate" })
    .sort({ createdAt: -1 })
    .lean();

  const activeMembers = (equipe.membres || []).filter((member: any) => member.status);
  const pendingMembers = (equipe.membres || []).filter((member: any) => !member.status);
  const captain = (equipe.chefId as any)?.userId;
  const totalPoints = enrollements.reduce((sum: number, enrollement: any) => sum + (enrollement.points || 0), 0);

  return (
    <main className="pb-20 pt-28 lg:pt-32">
      <section className="relative overflow-hidden bg-black">
        <div className="absolute inset-0">
          <Image src={BANNER_IMAGE} alt={equipe.designation} fill priority className="object-cover opacity-45" />
          <div className="absolute inset-0 bg-linear-to-r from-black via-black/80 to-black/45" />
        </div>

        <div className="relative mx-auto max-w-c-1280 px-4 py-16 md:px-8 lg:py-20 xl:px-0">
          <Link href="/equipes" className="mb-8 inline-flex text-sm font-medium text-white/70 transition hover:text-white">
            Retour aux equipes
          </Link>

          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div className="flex flex-col gap-6 md:flex-row md:items-end">
              <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-white/20 bg-white shadow-solid-8">
                {equipe.logo ? (
                  <Image src={equipe.logo} alt={equipe.designation} fill className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary/10 text-4xl font-bold text-primary">
                    {equipe.designation?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/75">
                  Equipe VIP
                </p>
                <h1 className="text-4xl font-bold text-white md:text-5xl">{equipe.designation}</h1>
                <p className="mt-3 text-sm text-white/65">
                  Capitaine : {captain?.pseudo || "A definir"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur-md">
              {[
                { label: "Membres actifs", value: activeMembers.length },
                { label: "Competitions", value: enrollements.length },
                { label: "Victoires", value: equipe.metriques?.matchsWin || 0 },
                { label: "Points", value: totalPoints },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-white/10 p-3">
                  <p className="text-2xl font-bold text-white">{item.value}</p>
                  <p className="mt-1 text-xs text-white/60">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-c-1280 px-4 md:px-8 xl:px-0">
        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
          <aside className="space-y-6">
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
              <h2 className="text-xl font-semibold text-black dark:text-white">A propos</h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-waterloo">
                {(equipe.description || []).length ? (
                  (equipe.description || []).map((line: string, index: number) => (
                    <p key={`${line}-${index}`}>{line}</p>
                  ))
                ) : (
                  <p>Aucune description publique pour cette equipe.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
              <h2 className="text-xl font-semibold text-black dark:text-white">Membres</h2>
              <div className="mt-4 space-y-3">
                {(equipe.membres || []).map((member: any) => {
                  const user = member.player?.userId;
                  return (
                    <div key={member.player?._id?.toString() || member.player?.toString()} className="flex items-center justify-between rounded-lg border border-stroke bg-alabaster px-4 py-3 dark:border-strokedark dark:bg-strokedark">
                      <div>
                        <p className="font-medium text-black dark:text-white">{user?.pseudo || "Membre"}</p>
                        <p className="text-sm text-waterloo">{member.isSecretary ? "Secretaire" : "Membre"}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${member.status ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {member.status ? "Actif" : "Invite"}
                      </span>
                    </div>
                  );
                })}
                {pendingMembers.length > 0 && (
                  <p className="text-xs text-waterloo">{pendingMembers.length} invitation(s) en attente.</p>
                )}
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-black dark:text-white">Competitions et sessions</h2>
                  <p className="mt-1 text-sm text-waterloo">Historique des enrollements de cette equipe.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {enrollements.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-stroke p-8 text-center text-sm text-waterloo dark:border-strokedark">
                    Cette equipe n'a pas encore d'enrollement.
                  </div>
                ) : (
                  enrollements.map((enrollement: any) => {
                    const competition = enrollement.competitionId;
                    const session = enrollement.sessionId;
                    return (
                      <article key={enrollement._id.toString()} className="rounded-lg border border-stroke bg-alabaster p-5 dark:border-strokedark dark:bg-strokedark">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-black dark:text-white">
                              {competition?.designation || "Competition"}
                            </h3>
                            <p className="mt-1 text-sm text-waterloo">
                              Session : {session?.designation || "A definir"}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${enrollement.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {enrollement.status}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-4">
                          <div>
                            <p className="text-xs text-waterloo">Points</p>
                            <p className="font-semibold text-black dark:text-white">{enrollement.points || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-waterloo">Parties</p>
                            <p className="font-semibold text-black dark:text-white">{enrollement.parties || 0}/{enrollement.maxParties || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-waterloo">Cagnotte</p>
                            <p className="font-semibold text-black dark:text-white">{competition?.cagnotte || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-waterloo">Recettes</p>
                            <p className="truncate font-mono text-xs font-semibold text-primary">{(equipe.metriques?.matchsWin || 0) * (competition?.cagnotte || 0) / (enrollement.maxParties || 1)} CDF</p>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
