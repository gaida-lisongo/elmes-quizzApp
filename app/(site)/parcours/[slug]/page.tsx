import { getParcoursBySlug } from "@/actions/parcours.actions";
import GamingPage from "@/components/Gaming";
import Testimonial from "@/components/Testimonial";
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

  console.log("ParcoursDetailPage: parcours data:", parcours);
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
    categories: parcours?.categories?.map(cat => ({id: cat?.slug, quest: cat?.designation, ans: cat?.description})) || []
  }
  const ctaData = {
    title: parcours?.status == 'ACTIVE' ? 
      "Vous pouvez vous inscire à ce parcours et tenter de remporter la couronne du mois" 
      : (parcours?.status == 'INACTIVE' ? "Se parcours est actullement indisponible"  : "Les inscriptions ne sont plus disponible" ),
    content: "À la fin de chaque parcours, les meilleurs profils sont couronnés selon leurs résultats, leur régularité et leur performance sous chrono.",
    action: {title: parcours?.status == 'ACTIVE' ? "S'inscrire" : 'Voir le classement' , url: parcours?.status == 'ACTIVE' ? 'subscripe' : 'pending' },
    classement: []
  }
  const testimonialsData = []
  const blogData = {}

  return (
    <GamingPage
      badge="Parcours"
      title={parcours.designation}
      description={parcours.description || "Un parcours d’entraînement pensé pour progresser pas à pas."}
      ctaLabel="Commencer l’entraînement"
      ctaHref="/auth/signup#advanced"
      stats={[
        { label: "Questions", value: String(parcours.questions || 0) },
        { label: "Catégories", value: String((parcours.categories || []).length) },
      ]}
      highlights={(parcours.categories || []).map((cat: any) => cat.designation)}
      about={aboutData}
      faq={faqData}
      cta={ctaData}
    >
      <Testimonial
        title={"Classement des meilleurs joueurs"}
        subtitle={"Découvrez les meilleurs joueurs du parcours"}
        description={"Les joueurs les plus performants du parcours sont mis en avant pour inspirer et motiver les autres participants."}
        data={testimonialsData}
      />
    </GamingPage>
  );
}