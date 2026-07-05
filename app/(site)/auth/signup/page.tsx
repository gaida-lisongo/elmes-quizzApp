import SignupPage from "./SignupPage";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inscription - ELMES-QUIZ | Rejoignez la première ligue numérique",
  description:
    "Créez votre compte ELMES-QUIZ et participez à la première ligue numérique des intellectuels et de la culture générale en RDC.",
};

interface Props {
  searchParams: Promise<{ code?: string }>;
}

export default async function Register({ searchParams }: Props) {
  const { code } = await searchParams;

  return <SignupPage referralCode={code || null} />;
}
