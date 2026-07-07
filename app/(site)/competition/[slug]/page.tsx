import { getCompetitionBySlug } from "@/actions/competitions.actions";
import { getClassementByRessourceAction, getCriteresForRessourceAction } from "@/actions/classement.actions";
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

  const [classementRes, criteresRes] = await Promise.all([
    getClassementByRessourceAction('Competition', competition._id),
    getCriteresForRessourceAction('Competition', competition._id),
  ]);

  const aboutData = {
    left: {
      image: '/images/hero/rules.png',
      title: 'Règles de la compétition',
      description: "Découvrez les règles de la compétition pour maximiser votre expérience et viser la première place.",
      rules : [
        {title: 'Équipe', description: 'Chaque équipe est composée de 5 joueurs, dont un chef qui gère les inscriptions.'},
        {title: 'Points', description: 'Chaque bonne réponse rapporte des points à votre équipe. Plus vous répondez vite, plus vous gagnez de points.'},
        {title: 'Partie', description: `Une partie se compose de ${competition.questions || 0} questions.`},
        {title: 'Cagnotte', description: `Une cagnotte de ${new Intl.NumberFormat().format(competition.cagnotte || 0)} F est à partager entre les meilleures équipes.`},
      ]
    },
    right: {
      image: '/images/hero/child.png',
      title: 'Compétition',
      subtitle: competition.designation || "Compétition",
      description: competition.description || "Rejoignez cette compétition et montrez votre niveau.",
    }
  }

  const faqData = {
    url: competition?.ressources || '',
    categories: competition?.categories?.map((cat: any) => ({id: cat?.slug, quest: cat?.designation, ans: cat?.description})) || []
  }

  const ctaData = {
    title: competition?.status == 'ACTIVE' ? 
      "Inscrivez votre équipe à cette compétition et tentez de remporter la cagnotte" 
      : (competition?.status == 'INACTIVE' ? "Cette compétition est actuellement indisponible" : "Les inscriptions sont closes"),
    content: `Frais d'inscription : ${new Intl.NumberFormat().format(competition.amount || 0)} F · Cagnotte : ${new Intl.NumberFormat().format(competition.cagnotte || 0)} F`,
    action: {title: competition?.status == 'ACTIVE' ? "Inscrire mon équipe" : 'Voir le classement', url: competition?.status == 'ACTIVE' ? 'subscripe' : 'classement'},
    classement: []
  }

  return (
    <GamingPage
      designation={competition.designation || "Compétition"}
      description={competition.description || "Rejoignez cette compétition et montrez votre niveau."}
      about={aboutData}
      faq={faqData}
      cta={ctaData}
      targetType="competition"
      targetId={competition._id}
      targetName={competition.designation}
      criteres={criteresRes.success ? criteresRes.criteres : []}
      classementData={classementRes.success ? classementRes.classement : []}
    />
  );
}