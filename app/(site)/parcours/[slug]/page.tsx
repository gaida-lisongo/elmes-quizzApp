import { getParcoursBySlug } from "@/actions/parcours.actions";
import { getClassementByRessourceAction, getCriteresForRessourceAction } from "@/actions/classement.actions";
import GamingPage from "@/components/Gaming";
import { notFound } from "next/navigation";

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

  const [classementRes, criteresRes] = await Promise.all([
    getClassementByRessourceAction('Parcours', parcours._id),
    getCriteresForRessourceAction('Parcours', parcours._id),
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
    url: parcours?.ressource || 'https://katalog.mikanda.info/pmb/opac_css/index.php',
    categories: parcours?.categories?.map((cat: any) => ({id: cat?.slug, quest: cat?.designation, ans: cat?.description})) || []
  }

  const ctaData = {
    title: parcours?.status == 'ACTIVE' ? 
      "Vous pouvez vous inscire à ce parcours et tenter de remporter la couronne du mois" 
      : (parcours?.status == 'INACTIVE' ? "Se parcours est actullement indisponible"  : "Les inscriptions ne sont plus disponible" ),
    content: "À la fin de chaque parcours, les meilleurs profils sont couronnés selon leurs résultats, leur régularité et leur performance sous chrono.",
    action: {title: parcours?.status == 'ACTIVE' ? "S'inscrire" : 'Voir le classement' , url: parcours?.status == 'ACTIVE' ? 'subscripe' : 'classement' },
    classement: []
  }

  return (
    <GamingPage
      designation={parcours.designation || "Parcours"}
      description={parcours.description || "Un parcours d'entraînement pensé pour progresser pas à pas."}
      about={aboutData}
      faq={faqData}
      cta={ctaData}
      targetType="parcours"
      targetId={parcours._id}
      targetName={parcours.designation}
      criteres={criteresRes.success ? criteresRes.criteres : []}
      classementData={classementRes.success ? classementRes.classement : []}
    />
  );
}