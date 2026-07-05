"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  User,
  Phone,
  School,
  Lock,
  Image as ImageIcon,
  Upload,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Shield,
  Trophy,
  Brain,
  Zap,
  Eye,
  EyeOff,
  Link as LinkIcon,
} from "lucide-react";
import Logo from "@/components/Common/Logo";
import { createPlayerStep1, createPlayerStep2 } from "@/actions/signup.actions";
import { useLoading } from "@/context/LoadingContext";
import type { PlayerType } from "@/actions/signup.actions";

interface SignupProps {
  playerType: PlayerType;
  referralCode: string | null;
}

const PLAYER_TYPES: {
  type: PlayerType;
  label: string;
  tagline: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  features: string[];
}[] = [
  {
    type: "STANDALONE",
    label: "Intelligent",
    tagline: "Joueur solo",
    icon: <Brain className="h-6 w-6" />,
    color: "text-emerald-500",
    bgColor: "bg-emerald-50 dark:bg-emerald-500/10",
    borderColor: "border-emerald-400",
    description: "Jouez des parties gratuites offertes chaque semaine et accumulez des tickets.",
    features: ["Parties gratuites chaque semaine", "Quiz en solo", "Gagne des tickets"],
  },
  {
    type: "ADVANCED",
    label: "Génie",
    tagline: "Joueur avancé",
    icon: <Zap className="h-6 w-6" />,
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-500/10",
    borderColor: "border-purple-400",
    description: "Parties offertes + inscriptions aux parcours pour tenter de remporter le prix mensuel.",
    features: ["Parties gratuites chaque semaine", "Parcours & classements", "Prix mensuel à gagner"],
  },
  {
    type: "VIP",
    label: "Compétiteur",
    tagline: "Joueur compétitif",
    icon: <Trophy className="h-6 w-6" />,
    color: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-500/10",
    borderColor: "border-amber-400",
    description: "Inscrivez votre équipe aux compétitions et remportez les gros lots chaque week-end.",
    features: ["Compétitions chaque week-end", "Matchs en direct", "Gros lots à gagner"],
  },
];

const Signup = ({ playerType: initialType, referralCode }: SignupProps) => {
  const router = useRouter();
  const { withLoading } = useLoading();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<PlayerType>(initialType);
  const [showPassword, setShowPassword] = useState(false);

  // Step 1 data
  const [step1Data, setStep1Data] = useState({
    pseudo: "",
    telephone: "",
    school: "",
  });

  // Step 2 data
  const [step2Data, setStep2Data] = useState({
    password: "",
    confirmPassword: "",
    photo: "",
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handleTypeSelect = (type: PlayerType) => {
    setSelectedType(type);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image valide.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhotoPreview(dataUrl);
      setStep2Data((prev) => ({ ...prev, photo: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleStep1Submit = async (e: FormEvent) => {
    e.preventDefault();

    const { pseudo, telephone, school } = step1Data;

    if (!pseudo.trim() || !telephone.trim() || !school.trim()) {
      toast.error("Tous les champs sont obligatoires.");
      return;
    }

// Validation téléphone: 0XX (max 10 chiffres) ou +243XXX (max 14 caractères)
    const phone = telephone.trim();
    const isValid =
      /^0\d{2,9}$/.test(phone) || // 0XX → max 10 chiffres au total
      /^\+243\d{6,11}$/.test(phone); // +243XXX → max 14 caractères (indicatif + 11 chiffres max)
    if (!isValid) {
      toast.error("Numéro de téléphone invalide. Formats acceptés: 0XX (10 chiffres max) ou +243XXX (14 car. max)");
      return;
    }

    try {
      const result = await withLoading(
        () =>
          createPlayerStep1({
            pseudo: pseudo.trim(),
            telephone: telephone.trim(),
            school: school.trim(),
            playerType: selectedType,
            referralCode: referralCode || undefined,
          }),
        "Vérification de vos informations…"
      );

      if (!result.success) {
        toast.error(result.error || "Erreur lors de la validation.");
        return;
      }

      toast.success("Informations validées !");
      setStep(2);
    } catch {
      toast.error("Une erreur est survenue.");
    }
  };

  const handleStep2Submit = async (e: FormEvent) => {
    e.preventDefault();

    const { password, confirmPassword } = step2Data;

    if (!password || password.length < 4) {
      toast.error("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      const result = await withLoading(
        () =>
          createPlayerStep2({
            password,
            photo: step2Data.photo || undefined,
          }),
        "Création de votre compte…"
      );

      if (!result.success) {
        toast.error(result.error || "Erreur lors de la création du compte.");
        return;
      }

      toast.success("Compte créé avec succès !");
      router.push(result.redirectTo || "/dashboard/standalone");
    } catch {
      toast.error("Une erreur est survenue.");
    }
  };

  const currentTypeInfo =
    PLAYER_TYPES.find((t) => t.type === selectedType) || PLAYER_TYPES[0];

  return (
    <section className="relative min-h-screen overflow-hidden pb-12.5 pt-32.5 lg:pb-25 lg:pt-45 xl:pb-30 xl:pt-50">
      {/* Éléments décoratifs de fond */}
      <div className="pointer-events-none absolute inset-0 -z-1">
        <div className="absolute left-0 top-0 h-2/3 w-full rounded-lg bg-linear-to-t from-transparent to-[#dee7ff47] dark:bg-linear-to-t dark:to-[#252A42]" />
        <div className="absolute bottom-17.5 left-0 h-1/3 w-full">
          <Image
            src="/images/shape/shape-dotted-light.svg"
            alt=""
            className="dark:hidden"
            fill
          />
          <Image
            src="/images/shape/shape-dotted-dark.svg"
            alt=""
            className="hidden dark:block"
            fill
          />
        </div>
        {/* Cercles lumineux */}
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-1 mx-auto max-w-c-1235 px-4 md:px-8 2xl:px-0">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-15 xl:gap-20">
          {/* Colonne gauche - Image de marque */}
          <motion.div
            variants={{
              hidden: { opacity: 0, x: -60 },
              visible: { opacity: 1, x: 0 },
            }}
            initial="hidden"
            whileInView="visible"
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="hidden lg:block"
          >
            <div className="sticky top-35">
              <div className="relative overflow-hidden rounded-2xl shadow-solid-8">
                <Image
                  src="/images/signup.jpg"
                  alt="ELMES-QUIZ - Inscription"
                  width={600}
                  height={800}
                  className="h-auto w-full object-cover"
                  priority
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />

                {/* Contenu superposé */}
                <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                  <Logo text="" href="/" className="mb-4" />
                  <h2 className="mb-3 text-3xl font-bold leading-tight">
                    ELMES-QUIZ
                  </h2>
                  <p className="text-base text-white/80">
                    La première ligue numérique des intellectuels et de la
                    culture générale en RDC.
                  </p>

                  {/* Stats */}
                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-white/10 p-3 text-center backdrop-blur-sm">
                      <p className="text-2xl font-bold">10+</p>
                      <p className="text-xs text-white/70">Quiz offerts</p>
                    </div>
                    <div className="rounded-lg bg-white/10 p-3 text-center backdrop-blur-sm">
                      <p className="text-2xl font-bold">3</p>
                      <p className="text-xs text-white/70">Niveaux</p>
                    </div>
                    <div className="rounded-lg bg-white/10 p-3 text-center backdrop-blur-sm">
                      <p className="text-2xl font-bold">∞</p>
                      <p className="text-xs text-white/70">Défis</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Colonne droite - Formulaire */}
          <motion.div
            variants={{
              hidden: { opacity: 0, x: 60 },
              visible: { opacity: 1, x: 0 },
            }}
            initial="hidden"
            whileInView="visible"
            transition={{ duration: 0.8, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <div className="rounded-2xl bg-white p-6 shadow-solid-8 dark:border dark:border-strokedark dark:bg-black md:p-10 xl:p-12">
              {/* Logo + Titre */}
              <div className="mb-8 text-center">
                <div className="mb-4 flex justify-center">
                  <Logo text="" href="/" />
                </div>
                <h2 className="text-2xl font-bold text-black dark:text-white xl:text-3xl">
                  Créer un compte
                </h2>
                <p className="mt-2 text-waterloo">
                  Rejoignez la communauté ELMES-QUIZ
                </p>
              </div>

              {/* Barre de progression */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        step >= 1
                          ? "bg-primary text-white"
                          : "bg-stroke text-waterloo dark:bg-strokedark"
                      }`}
                    >
                      {step > 1 ? <Check className="h-4 w-4" /> : "1"}
                    </div>
                    <span className="text-sm font-medium text-black dark:text-white">
                      Profil
                    </span>
                  </div>
                  <div
                    className={`mx-4 h-0.5 flex-1 ${
                      step >= 2
                        ? "bg-primary"
                        : "bg-stroke dark:bg-strokedark"
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        step >= 2
                          ? "bg-primary text-white"
                          : "bg-stroke text-waterloo dark:bg-strokedark"
                      }`}
                    >
                      2
                    </div>
                    <span className="text-sm font-medium text-black dark:text-white">
                      Sécurité
                    </span>
                  </div>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.form
                    key="step1"
                    onSubmit={handleStep1Submit}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Sélection du type de joueur */}
                    <div className="mb-6">
                      <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                        Type de joueur
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {PLAYER_TYPES.map((pt) => (
                          <button
                            key={pt.type}
                            type="button"
                            onClick={() => handleTypeSelect(pt.type)}
                            className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-all duration-200 ${
                              selectedType === pt.type
                                ? `${pt.borderColor} ${pt.bgColor} shadow-lg`
                                : "border-stroke dark:border-strokedark hover:border-primary/50"
                            }`}
                          >
                            <div
                              className={`${
                                selectedType === pt.type
                                  ? pt.color
                                  : "text-waterloo"
                              }`}
                            >
                              {pt.icon}
                            </div>
                            <div>
                              <p
                                className={`text-xs font-bold ${
                                  selectedType === pt.type
                                    ? "text-black dark:text-white"
                                    : "text-waterloo"
                                }`}
                              >
                                {pt.label}
                              </p>
                              <p className="text-[10px] text-waterloo">
                                {pt.tagline}
                              </p>
                            </div>
                            {selectedType === pt.type && (
                              <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Type sélectionné - Features */}
                    <motion.div
                      key={selectedType}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mb-6 overflow-hidden rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 p-4"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-black dark:text-white">
                          {currentTypeInfo.label}
                        </span>
                      </div>
                      <p className="mb-3 text-xs text-waterloo leading-relaxed">
                        {currentTypeInfo.description}
                      </p>
                      <ul className="space-y-1">
                        {currentTypeInfo.features.map((f, i) => (
                          <li
                            key={i}
                            className="flex items-center gap-2 text-sm text-waterloo"
                          >
                            <Check className="h-3.5 w-3.5 text-primary" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </motion.div>

                    {/* Code d'affiliation */}
                    {referralCode && (
                      <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4 dark:bg-amber-500/10">
                        <LinkIcon className="h-5 w-5 text-amber-500" />
                        <div>
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                            Code d&apos;affiliation
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Vous êtes invité par le code{" "}
                            <strong>{referralCode}</strong>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Champs du formulaire */}
                    <div className="mb-6 space-y-5">
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                          <User className="h-4 w-4 text-primary" />
                          Pseudo
                        </label>
                        <input
                          type="text"
                          placeholder="Votre pseudo"
                          value={step1Data.pseudo}
                          onChange={(e) =>
                            setStep1Data((prev) => ({
                              ...prev,
                              pseudo: e.target.value,
                            }))
                          }
                          required
                          className="w-full rounded-xl border border-stroke bg-transparent px-5 py-3 text-black outline-hidden transition-all duration-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,107,255,0.1)] dark:border-strokedark dark:text-white dark:focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                          <Phone className="h-4 w-4 text-primary" />
                          Téléphone
                        </label>
                        <input
                          type="tel"
                          placeholder="09XXXXXXXX"
                          value={step1Data.telephone}
                          onChange={(e) =>
                            setStep1Data((prev) => ({
                              ...prev,
                              telephone: e.target.value,
                            }))
                          }
                          required
                          className="w-full rounded-xl border border-stroke bg-transparent px-5 py-3 text-black outline-hidden transition-all duration-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,107,255,0.1)] dark:border-strokedark dark:text-white dark:focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                          <School className="h-4 w-4 text-primary" />
                          Établissement
                        </label>
                        <input
                          type="text"
                          placeholder="Nom de votre école/université"
                          value={step1Data.school}
                          onChange={(e) =>
                            setStep1Data((prev) => ({
                              ...prev,
                              school: e.target.value,
                            }))
                          }
                          required
                          className="w-full rounded-xl border border-stroke bg-transparent px-5 py-3 text-black outline-hidden transition-all duration-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,107,255,0.1)] dark:border-strokedark dark:text-white dark:focus:border-primary"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-medium text-white transition-all duration-200 hover:bg-primaryho"
                    >
                      Continuer
                      <ArrowRight className="h-5 w-5" />
                    </button>

                    <p className="mt-4 text-center text-sm text-waterloo">
                      Déjà un compte ?{" "}
                      <Link
                        href="/auth/signin"
                        className="font-medium text-primary hover:underline"
                      >
                        Connectez-vous
                      </Link>
                    </p>
                  </motion.form>
                )}

                {step === 2 && (
                  <motion.form
                    key="step2"
                    onSubmit={handleStep2Submit}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Résumé rapide */}
                    <div className="mb-6 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-waterloo">
                            Inscription en tant que
                          </p>
                          <p className="font-semibold text-black dark:text-white">
                            {step1Data.pseudo || "..."}{" "}
                            <span className="text-primary">
                              ({currentTypeInfo.label})
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="text-xs text-primary hover:underline"
                        >
                          Modifier
                        </button>
                      </div>
                    </div>

                    {/* Photo de profil */}
                    <div className="mb-6">
                      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                        <ImageIcon className="h-4 w-4 text-primary" />
                        Photo de profil
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-dashed border-stroke dark:border-strokedark">
                          {photoPreview ? (
                            <Image
                              src={photoPreview}
                              alt="Aperçu"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-stroke/50 dark:bg-strokedark/50">
                              <Upload className="h-6 w-6 text-waterloo" />
                            </div>
                          )}
                        </div>
                        <label className="cursor-pointer rounded-lg border border-stroke px-4 py-2 text-sm text-waterloo transition-all hover:border-primary hover:text-primary dark:border-strokedark">
                          <span>Choisir une photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <p className="mt-1.5 text-xs text-waterloo">
                        Optionnel. Format JPG, PNG. Max 10 Mo.
                      </p>
                    </div>

                    {/* Mot de passe */}
                    <div className="mb-6 space-y-5">
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                          <Lock className="h-4 w-4 text-primary" />
                          Mot de passe
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Minimum 4 caractères"
                            value={step2Data.password}
                            onChange={(e) =>
                              setStep2Data((prev) => ({
                                ...prev,
                                password: e.target.value,
                              }))
                            }
                            required
                            className="w-full rounded-xl border border-stroke bg-transparent px-5 py-3 pr-12 text-black outline-hidden transition-all duration-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,107,255,0.1)] dark:border-strokedark dark:text-white dark:focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-waterloo hover:text-primary"
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                          <Shield className="h-4 w-4 text-primary" />
                          Confirmer le mot de passe
                        </label>
                        <input
                          type="password"
                          placeholder="Retaper le mot de passe"
                          value={step2Data.confirmPassword}
                          onChange={(e) =>
                            setStep2Data((prev) => ({
                              ...prev,
                              confirmPassword: e.target.value,
                            }))
                          }
                          required
                          className="w-full rounded-xl border border-stroke bg-transparent px-5 py-3 text-black outline-hidden transition-all duration-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,107,255,0.1)] dark:border-strokedark dark:text-white dark:focus:border-primary"
                        />
                      </div>
                    </div>

                    {/* Indicateur de force du mot de passe */}
                    {step2Data.password && (
                      <div className="mb-6">
                        <div className="mb-1 flex gap-1">
                          {[1, 2, 3].map((level) => (
                            <div
                              key={level}
                              className={`h-1.5 flex-1 rounded-full transition-all ${
                                step2Data.password.length >= level * 4
                                  ? step2Data.password.length >= 8
                                    ? "bg-emerald-500"
                                    : step2Data.password.length >= 6
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                  : "bg-stroke dark:bg-strokedark"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-waterloo">
                          {step2Data.password.length === 0
                            ? ""
                            : step2Data.password.length < 4
                              ? "Trop court"
                              : step2Data.password.length < 8
                                ? "Moyen"
                                : "Fort"}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-stroke px-6 py-3.5 font-medium text-black transition-all duration-200 hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark"
                      >
                        <ArrowLeft className="h-5 w-5" />
                        Retour
                      </button>
                      <button
                        type="submit"
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-medium text-white transition-all duration-200 hover:bg-primaryho"
                      >
                        Créer mon compte
                        <Check className="h-5 w-5" />
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Signup;
