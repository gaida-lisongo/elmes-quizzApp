import SignupPage from "./SignupPage";
import { Metadata } from "next";
import { buildMetadata } from "@/lib/utils/metadata";

export const metadata: Metadata = buildMetadata("Inscription");

interface Props {
  searchParams: Promise<{ code?: string }>;
}

export default async function Register({ searchParams }: Props) {
  const { code } = await searchParams;

  return <SignupPage referralCode={code || null} />;
}
