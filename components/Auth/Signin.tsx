"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/actions/auth.actions";
import toast from "react-hot-toast";
import {
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  LogIn,
  Sparkles,
  Brain,
  Shield,
} from "lucide-react";
import Logo from "@/components/Common/Logo";

const Signin = () => {
  const router = useRouter();
  const [data, setData] = useState({
    telephone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("telephone", data.telephone);
      formData.append("password", data.password);

      const result = await loginUser(formData);

      if (!result.success) {
        toast.error(result.error || "Identifiants incorrects");
        return;
      }

      toast.success("Connexion réussie !");
      router.push(result.redirectTo || "/dashboard");
    } catch {
      toast.error("Erreur lors de la connexion");
    } finally {
      setLoading(false);
    }
  };

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
                  alt="ELMES-QUIZ - Connexion"
                  width={600}
                  height={800}
                  className="h-auto w-full object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                  <Logo text="" href="/" className="mb-4" />
                  <h2 className="mb-3 text-3xl font-bold leading-tight">
                    ELMES-QUIZ
                  </h2>
                  <p className="text-base text-white/80">
                    La première ligue numérique des intellectuels et de la
                    culture générale en RDC.
                  </p>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3 rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                      <Brain className="h-5 w-5 text-emerald-300" />
                      <p className="text-sm text-white/90">
                        <strong>Intelligent :</strong> Parties gratuites chaque
                        semaine
                      </p>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                      <Sparkles className="h-5 w-5 text-purple-300" />
                      <p className="text-sm text-white/90">
                        <strong>Génie :</strong> Parcours & prix mensuel
                      </p>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                      <Shield className="h-5 w-5 text-amber-300" />
                      <p className="text-sm text-white/90">
                        <strong>Compétiteur :</strong> Compétitions & gros lots
                      </p>
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
                  Connexion
                </h2>
                <p className="mt-2 text-waterloo">
                  Accédez à votre espace personnel
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Téléphone */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                    <Phone className="h-4 w-4 text-primary" />
                    Numéro de téléphone
                  </label>
                  <input
                    type="tel"
                    placeholder="09XXXXXXXX ou +243XXXXXXXXX"
                    name="telephone"
                    value={data.telephone}
                    onChange={(e) =>
                      setData({ ...data, telephone: e.target.value })
                    }
                    required
                    className="w-full rounded-xl border border-stroke bg-transparent px-5 py-3 text-black outline-hidden transition-all duration-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,107,255,0.1)] dark:border-strokedark dark:text-white dark:focus:border-primary"
                  />
                </div>

                {/* Mot de passe */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                    <Lock className="h-4 w-4 text-primary" />
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Votre mot de passe"
                      name="password"
                      value={data.password}
                      onChange={(e) =>
                        setData({ ...data, password: e.target.value })
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

                {/* Options */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      id="remember"
                      type="checkbox"
                      className="h-4 w-4 rounded border-stroke text-primary focus:ring-primary dark:border-strokedark"
                    />
                    <label
                      htmlFor="remember"
                      className="text-sm text-waterloo select-none"
                    >
                      Rester connecté
                    </label>
                  </div>
                  <a
                    href="#"
                    className="text-sm text-primary hover:text-primaryho hover:underline"
                  >
                    Mot de passe oublié ?
                  </a>
                </div>

                {/* Bouton */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-medium text-white transition-all duration-200 hover:bg-primaryho disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Connexion en cours...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5" />
                      Se connecter
                    </>
                  )}
                </button>

                {/* Séparateur */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-stroke dark:border-strokedark" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-4 text-waterloo dark:bg-black">
                      ou
                    </span>
                  </div>
                </div>

                {/* Lien inscription */}
                <div className="text-center">
                  <p className="text-sm text-waterloo">
                    Pas encore de compte ?{" "}
                    <Link
                      href="/auth/signup"
                      className="font-medium text-primary hover:underline"
                    >
                      Créer un compte
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Signin;
