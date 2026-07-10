import { getParcoursBySlug } from "@/actions/parcours.actions";
import { getClassementByRessourceAction, getCriteresForRessourceAction } from "@/actions/classement.actions";
import { getCurrentPlayerInfoAction, getSessionsByRessourceAction } from "@/actions/enrollment.actions";
import GamingPage from "@/components/Gaming";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { buildMetadata } from "@/lib/utils/metadata";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const res = await getParcoursBySlug(slug);
  if (res.success && res.parcours) {
    return buildMetadata(res.parcours.designation);
  }
  return buildMetadata("Parcours");
}

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
  console.log("Details of parcours : ", parcours)

  const [classementRes, criteresRes, playerInfoRes, sessionsRes] = await Promise.all([
    getClassementByRessourceAction('Parcours', parcours._id),
    getCriteresForRessourceAction('Parcours', parcours._id),
    getCurrentPlayerInfoAction(),
    getSessionsByRessourceAction('Parcours', parcours._id),
  ]);

  const aboutData = {
    left: {
      image: '/images/hero/rules.png',
      title: 'Règles du parcours',
      description: "Découvrez les règles du parcours pour maximiser votre expérience de jeu et progresser efficacement.",
      rules : [
        {title: 'Durée', description: 'Chaque question est chronométrée, vous devez répondre dans le temps imparti, soit 15 secondes.'},
        {title: 'Points', description: 'Chaque bonne réponse vous rapporte 1 point, plus vous répondez vite, plus vous gagnez de points.'},
        {title: 'Partie', description: `Une partie se compose de ${parcours.questions || 0} questions, à la fin de la partie, vous obtenez un score et un classement.`},
        {title: 'Fin de la partie', description: 'La partie se termine lorsqu\'une mauvaise réponse est donnée ou lorsque toutes les questions ont été répondues.'},
      ]
    },
    right: {
      image: '/images/hero/child.png',
      title: 'Entraînez-vous et progressez',
      subtitle: parcours.designation || "Parcours d’entraînement",
      description: parcours.description || "Un parcours d’entraînement pensé pour progresser pas à pas.",
    }
  }

  const faqData = {
    url: parcours?.ressource || 'http://livre21.com/LIVREF/F13/F013085.pdf',
    categories: parcours?.categories?.map((cat: any) => ({id: cat?.slug, quest: cat?.designation, ans: cat?.description})) || []
  }

  const canEnroll = parcours?.status === 'ACTIVE' && playerInfoRes.success && !!playerInfoRes.player;

  const ctaData = {
    title: canEnroll
      ? "Vous pouvez vous inscrire à ce parcours et tenter de remporter la couronne du mois"
      : parcours?.status === 'ACTIVE'
        ? "Ce parcours nécessite un profil ADVANCED pour s'inscrire"
        : parcours?.status === 'INACTIVE'
          ? "Ce parcours est actuellement indisponible"
          : "Les inscriptions ne sont plus disponibles",
    content: "À la fin de chaque parcours, les meilleurs profils sont couronnés selon leurs résultats, leur régularité et leur performance sous chrono.",
    action: { title: canEnroll ? "S'inscrire" : 'Voir le classement', url: canEnroll ? 'subscripe' : 'classement' },
    classement: []
  }

  return (
    <GamingPage
      designation={parcours.designation || "Parcours"}
      description={parcours.description || "Un parcours d'entraînement pensé pour progresser pas à pas."}
      image={parcours.image || null}
      about={aboutData}
      faq={faqData}
      cta={ctaData}
      targetType="parcours"
      targetId={parcours._id}
      targetName={parcours.designation}
      criteres={criteresRes.success ? criteresRes.criteres : []}
      classementData={classementRes.success ? classementRes.classement : []}
      sessions={sessionsRes.success ? sessionsRes.sessions : []}
      enrollmentInfo={playerInfoRes.success && playerInfoRes.player ? { type: 'player' as const, _id: playerInfoRes.player._id, pseudo: playerInfoRes.player.pseudo, level: playerInfoRes.player.level, telephone: playerInfoRes.player.telephone, email: playerInfoRes.player.email } : null}
    />
  );
}
