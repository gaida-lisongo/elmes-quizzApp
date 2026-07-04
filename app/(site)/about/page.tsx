import AboutLeft from "@/components/About/AboutLeft";
import AboutRight from "@/components/About/AboutRight";
import AboutEntreprise from "@/components/About/AboutEntreprise";
import FeaturesTab from "@/components/FeaturesTab";
import Team from "@/components/Team";
import { LandingPage } from "@/lib/models/Landing";
import { getSession } from "@/lib/utils/auth";
import connectToDb from "@/lib/utils/db";

export default async function AboutPage() {
    const session = await getSession();
    
    const isAdmin = session?.role === "ADMIN" || true;

    await connectToDb();

    const landing = await LandingPage.findOne().lean();

    const promesses = JSON.parse(JSON.stringify(landing?.promises || []));
    const valeurs = JSON.parse(JSON.stringify(landing?.values || []));
    const equipe = JSON.parse(JSON.stringify(landing?.team || []));
    const aboutElmes = {
        sigle: "ELMES",
        title: "ELectro MEcatronique Services",
        whois: "ELMES, une entreprise numérique au service de l'apprentissage utile",
        description: [
            "ELMES est une initiative technologique qui développe des solutions numériques adaptées aux besoins éducatifs, académiques et organisationnels en République Démocratique du Congo.",
            "Avec ELMES-QUIZ, l'entreprise veut créer une passerelle entre culture générale, compétition intellectuelle, progression personnelle et valorisation des talents. Notre ambition est de rendre l'apprentissage plus vivant, plus accessible et plus engageant.",
            "Nous avons donc conçu une plateforme légère, jouable depuis un navigateur, capable de transformer quelques minutes d'attention en entraînement, en classement et en défi."
        ],
        image: '/images/logo/elmes-logo.png',
        matricules: {
            rccm: "CD/KNG/RCCM/21-A-01470",
            idNat: "01-G470-N79159G",
            affCnss: "1015117500",
            imInpp: "89678"
        }
    };

    return (
        <section className="overflow-hidden pb-20 pt-35 md:pt-40 xl:pb-25 xl:pt-46">
            <AboutRight isAdmin={isAdmin} promesses={promesses} />
            <FeaturesTab isAdmin={isAdmin} valeurs={valeurs} />
            <AboutEntreprise aboutElmes={aboutElmes} />
            <Team isAdmin={isAdmin} team={equipe} />
        </section>
    )
}