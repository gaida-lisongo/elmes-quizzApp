import { getCompetitionBySlug } from "@/actions/competitions.actions";
import { getClassementByRessourceAction, getCriteresForRessourceAction } from "@/actions/classement.actions";
import { getCurrentEquipeInfoAction, getSessionsByRessourceAction } from "@/actions/enrollment.actions";
import GamingPage from "@/components/Gaming";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { buildMetadata } from "@/lib/utils/metadata";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const res = await getCompetitionBySlug(slug);
  if (res.success && res.competition) {
    return buildMetadata(res.competition.designation);
  }
  return buildMetadata("Compétition");
}

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

  // Serialize competition data to convert ObjectIds to strings
  const serializedCompetition = {
    ...competition,
    _id: competition._id.toString(),
    categories: competition.categories?.map((cat: any) => ({
      ...cat,
      _id: cat._id?.toString(),
    })),
  };

  const [classementRes, criteresRes, equipeInfoRes, sessionsRes] = await Promise.all([
    getClassementByRessourceAction('Competition', competition._id),
    getCriteresForRessourceAction('Competition', competition._id),
    getCurrentEquipeInfoAction(),
    getSessionsByRessourceAction('Competition', competition._id),
  ]);

  const aboutData = {
    left: {
      image: '/images/hero/rules.png',
      title: 'Règles de la compétition',
      description: "Découvrez les règles de la compétition pour maximiser votre expérience et viser la première place.",
      rules : [
        {title: 'Équipe', description: 'Chaque équipe est composée de 5 joueurs, dont un chef qui gère les inscriptions.'},
        {title: 'Points', description: 'Chaque bonne réponse rapporte des points à votre équipe. Plus vous répondez vite, plus vous gagnez de points.'},
        {title: 'Partie', description: `Une partie se compose de ${serializedCompetition.questions || 0} questions.`},
        {title: 'Cagnotte', description: `Une cagnotte de ${new Intl.NumberFormat().format(serializedCompetition.cagnotte || 0)} F est à partager entre les meilleures équipes.`},
      ]
    },
    right: {
      image: '/images/hero/child.png',
      title: 'Compétition',
      subtitle: serializedCompetition.designation || "Compétition",
      description: serializedCompetition.description || "Rejoignez cette compétition et montrez votre niveau.",
    }
  }

  const faqData = {
    url: serializedCompetition?.ressources || 'http://livre21.com/LIVREF/F13/F013085.pdf',
    categories: serializedCompetition?.categories?.map((cat: any) => ({id: cat?.slug, quest: cat?.designation, ans: cat?.description})) || []
  }

  const canEnroll = serializedCompetition?.status === 'ACTIVE' && equipeInfoRes.success && !!equipeInfoRes.equipe;

  const ctaData = {
    title: canEnroll
      ? "Inscrivez votre équipe à cette compétition et tentez de remporter la cagnotte"
      : serializedCompetition?.status === 'ACTIVE'
        ? "Cette compétition nécessite un profil VIP et d'être chef d'une équipe"
        : serializedCompetition?.status === 'INACTIVE'
          ? "Cette compétition est actuellement indisponible"
          : "Les inscriptions sont closes",
    content: `Frais d'inscription : ${new Intl.NumberFormat().format(serializedCompetition.amount || 0)} F · Cagnotte : ${new Intl.NumberFormat().format(serializedCompetition.cagnotte || 0)} F`,
    action: { title: canEnroll ? "Inscrire mon équipe" : 'Voir le classement', url: canEnroll ? 'subscripe' : 'classement' },
    classement: [],
    amount: serializedCompetition?.amount
  }

  return (
    <GamingPage
      designation={serializedCompetition.designation || "Compétition"}
      description={serializedCompetition.description || "Rejoignez cette compétition et montrez votre niveau."}
      image={serializedCompetition.image || null}
      about={aboutData}
      faq={faqData}
      cta={ctaData}
      targetType="competition"
      targetId={serializedCompetition._id}
      targetName={serializedCompetition.designation}
      criteres={criteresRes.success ? criteresRes.criteres : []}
      classementData={classementRes.success ? classementRes.classement : []}
      sessions={sessionsRes.success ? sessionsRes.sessions : []}
      enrollmentInfo={equipeInfoRes.success && equipeInfoRes.equipe ? { type: 'equipe', ...equipeInfoRes.equipe } : null}
    />
  );
}
