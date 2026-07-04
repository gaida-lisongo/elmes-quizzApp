import AboutLeft from "@/components/About/AboutLeft";
import AboutRight from "@/components/About/AboutRight";
import { LandingPage } from "@/lib/models/Landing";
import { getSession } from "@/lib/utils/auth";
import connectToDb from "@/lib/utils/db";

export default async function AboutPage() {
    const session = await getSession();
    
    const isAdmin = session?.role === "ADMIN" || true;

    await connectToDb();

    const landing = await LandingPage.findOne().lean();

    const promesses = landing?.promises || [];
    const valeurs = landing?.values || [];
    const equipe = landing?.team || [];
    const aboutElmes = landing?.aboutElmes || {};

    return (
        <section className="overflow-hidden pb-20 pt-35 md:pt-40 xl:pb-25 xl:pt-46">
            <AboutRight isAdmin={isAdmin} promesses={promesses} />
            <AboutLeft />
        </section>
    )
}