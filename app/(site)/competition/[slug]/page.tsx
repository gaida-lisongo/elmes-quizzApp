import { getCompetitionBySlug } from "@/actions/competitions.actions";
import { notFound } from "next/navigation";
import Link from "next/link";

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
    <section className="overflow-hidden pb-20 pt-35 md:pt-40 xl:pb-25 xl:pt-46">
      <div className="mx-auto max-w-c-1390 px-4 md:px-8 2xl:px-0">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-waterloo hover:text-primary"
          >
            ← Retour à l&apos;accueil
          </Link>
        </div>
        <div className="rounded-lg border border-stroke bg-white p-8 shadow-solid-3 dark:border-strokedark dark:bg-blacksection">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-[4px] bg-primary text-3xl font-bold text-white">
              {competition.designation.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-black dark:text-white">
                {competition.designation}
              </h1>
              <p className="mt-1 text-waterloo">
                {competition.questions} questions · {competition.categories?.length || 0} catégories
              </p>
            </div>
          </div>

          <p className="mb-6 text-lg">{competition.description}</p>

          {competition.categories && competition.categories.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-lg font-semibold text-black dark:text-white">Catégories</h3>
              <div className="flex flex-wrap gap-3">
                {competition.categories.map((cat: any) => (
                  <span
                    key={cat._id}
                    className="rounded-full bg-primary/10 px-4 py-2 text-sm text-primary"
                  >
                    {cat.designation}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mb-8 grid grid-cols-2 gap-6">
            <div className="rounded-lg bg-alabaster p-6 text-center dark:bg-strokedark">
              <p className="text-sm text-waterloo">Cagnotte</p>
              <p className="text-3xl font-bold text-primary">
                {new Intl.NumberFormat().format(competition.cagnotte)} F
              </p>
            </div>
            <div className="rounded-lg bg-alabaster p-6 text-center dark:bg-strokedark">
              <p className="text-sm text-waterloo">Inscription</p>
              <p className="text-3xl font-bold text-black dark:text-white">
                {new Intl.NumberFormat().format(competition.amount)} F
              </p>
            </div>
          </div>

          <Link
            href={`/auth/signup#vip`}
            className="inline-flex rounded-full bg-primary px-8 py-3 text-white transition hover:bg-primaryho"
          >
            Rejoindre la compétition
          </Link>
        </div>
      </div>
    </section>
  );
}