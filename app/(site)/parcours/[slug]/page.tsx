import { getParcoursBySlug } from "@/actions/parcours.actions";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function ParcoursDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await getParcoursBySlug(slug);

  if (!res.success || !res.parcours) {
    notFound();
  }

  const parcours = res.parcours;

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
              {parcours.designation.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-black dark:text-white">
                {parcours.designation}
              </h1>
              <p className="mt-1 text-waterloo">
                {parcours.questions} questions · {parcours.categories?.length || 0} catégories
              </p>
            </div>
          </div>

          <p className="mb-6 text-lg">{parcours.description}</p>

          {parcours.categories && parcours.categories.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-lg font-semibold text-black dark:text-white">Catégories</h3>
              <div className="flex flex-wrap gap-3">
                {parcours.categories.map((cat: any) => (
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

          <div className="mt-8">
            <Link
              href={`/auth/signup#advanced`}
              className="inline-flex rounded-full bg-primary px-8 py-3 text-white transition hover:bg-primaryho"
            >
              Commencer l&apos;entraînement
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}