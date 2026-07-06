import { getCompetitionBySlug } from "@/actions/competitions.actions";
import GamingPage from "@/components/Gaming";
import { notFound } from "next/navigation";

export default async function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await getCompetitionBySlug(slug);

  if (!res.success || !res.competition) {
    notFound();
  }

  const competition = res.competition;

  return (
    <GamingPage
      badge="Compétition"
      title={competition.designation}
      description={competition.description || "Rejoignez cette compétition et montrez votre niveau."}
      ctaLabel="Rejoindre la compétition"
      ctaHref="/auth/signup#vip"
      stats={[
        { label: "Questions", value: String(competition.questions || 0) },
        { label: "Cagnotte", value: `${new Intl.NumberFormat().format(competition.cagnotte || 0)} F` },
        { label: "Inscription", value: `${new Intl.NumberFormat().format(competition.amount || 0)} F` },
      ]}
      highlights={(competition.categories || []).map((cat: any) => cat.designation)}
    >
      <div className="rounded-[32px] border border-stroke bg-white p-8 shadow-solid-8 dark:border-strokedark dark:bg-blacksection">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="text-2xl font-semibold text-black dark:text-white">Présentation</h2>
            <p className="mt-4 text-lg leading-8 text-waterloo">{competition.description}</p>
          </div>
          <div className="rounded-3xl border border-stroke bg-alabaster p-6 dark:border-strokedark dark:bg-strokedark">
            <h3 className="text-lg font-semibold text-black dark:text-white">Catégories</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {(competition.categories || []).map((cat: any) => (
                <span key={cat._id} className="rounded-full bg-primary/10 px-3 py-2 text-sm text-primary">
                  {cat.designation}
                </span>
              ))}
            </div>
            <div className="mt-6 space-y-3 text-sm text-waterloo">
              <div className="flex items-center justify-between rounded-2xl border border-stroke bg-white px-4 py-3 dark:border-strokedark dark:bg-black">
                <span>Cagnotte</span>
                <span className="font-semibold text-black dark:text-white">{new Intl.NumberFormat().format(competition.cagnotte || 0)} F</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-stroke bg-white px-4 py-3 dark:border-strokedark dark:bg-black">
                <span>Frais d’inscription</span>
                <span className="font-semibold text-black dark:text-white">{new Intl.NumberFormat().format(competition.amount || 0)} F</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GamingPage>
  );
}