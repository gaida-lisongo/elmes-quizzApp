'use client';

import { confirmEquipeCreationAction, initiateEquipeCreationAction, type EquipeSummary } from "@/actions/equipe.actions";
import SearchUserInput, { type SearchUserResult } from "@/components/Common/SearchUserInput";
import { motion } from "framer-motion";
import { BadgeCheck, CreditCard, Search, Sparkles, Users } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

const HERO_IMAGE = "/images/team/team.png";
const FALLBACK_LOGO = "/images/team/team-3.png";

export default function EquipesPageClient({ equipes }: { equipes: EquipeSummary[] }) {
  const [items, setItems] = useState(equipes);
  const [query, setQuery] = useState("");
  const [step, setStep] = useState(1);
  const [captain, setCaptain] = useState<SearchUserResult | null>(null);
  const [phone, setPhone] = useState("");
  const [design, setDesign] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredEquipes = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      const haystack = `${item.designation} ${item.description?.join(" ")} ${item.chefId?.userId?.pseudo || ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [items, query]);

  const handleCaptainSelect = (user: SearchUserResult) => {
    setCaptain(user);
    setPhone(user.telephone);
    setError("");
    setStep(2);
  };

  const handleInitiate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!captain) {
      setError("Sélectionnez d’abord un capitaine.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    const result = await initiateEquipeCreationAction(
      captain.playerId || captain._id,
      design,
      description,
      logo || FALLBACK_LOGO,
      phone
    );

    if (!result.success) {
      setError(result.error || "Impossible d’initier le paiement.");
      setLoading(false);
      return;
    }

    setOrderNumber(result.orderNumber || "");
    setMessage(result.message || "Paiement initié.");
    setStep(3);
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!captain || !orderNumber) return;

    setLoading(true);
    setError("");
    setMessage("");

    const result = await confirmEquipeCreationAction({
      captainId: captain.playerId || captain._id,
      designation: design,
      description,
      logo: logo || FALLBACK_LOGO,
      orderNumber,
    });

    if (!result.success) {
      setError(result.error || "La confirmation a échoué.");
      setLoading(false);
      return;
    }

    if (result.success) {
      setItems((prev) => [result.equipe, ...prev]);
    }
    setMessage("Équipe créée avec succès. Elle est maintenant visible dans la liste.");
    setStep(1);
    setCaptain(null);
    setPhone("");
    setDesign("");
    setDescription("");
    setLogo("");
    setOrderNumber("");
    setLoading(false);
  };

  return (
    <main>
      <section className="relative overflow-hidden bg-black py-20 lg:py-28">
        <div className="absolute inset-0">
          <Image src={HERO_IMAGE} alt="Équipes" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/70" />
        </div>

        <div className="relative mx-auto max-w-c-1280 px-4 md:px-8 xl:px-0">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white/90 backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Rejoignez la communauté des équipes
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Découvrez et créer des équipes de compétition.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/80">
                Trouvez la bonne équipe, préparez votre inscription en quelques secondes et démarrez l’aventure avec un accompagnement simple.
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <label className="mb-2 block text-sm font-medium text-white">Rechercher une équipe</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nom, capitaine ou description"
                  className="w-full rounded-xl border border-white/20 bg-black/20 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/60"
                />
              </div>
              <p className="mt-3 text-sm text-white/70">
                La recherche vous aide à retrouver les équipes déjà inscrites dans la plateforme.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-25 xl:py-30">
        <div className="mx-auto max-w-c-1280 px-4 md:px-8 xl:px-0">
          <div className="grid gap-8 xl:grid-cols-[1.45fr_0.85fr]">
            <div className="space-y-8">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Équipes</p>
                  <h2 className="text-2xl font-semibold text-black dark:text-white">Toutes les équipes enregistrées</h2>
                </div>
                <p className="text-sm text-waterloo">{filteredEquipes.length} résultat{filteredEquipes.length > 1 ? "s" : ""}</p>
              </div>

              <div className="grid gap-7.5 md:grid-cols-2 xl:gap-10">
                {filteredEquipes.map((equipe, index) => (
                  <motion.article
                    key={equipe._id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="rounded-2xl border border-stroke bg-white p-4 shadow-solid-8 dark:border-strokedark dark:bg-blacksection"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-alabaster dark:bg-strokedark">
                      {equipe.logo ? (
                        <img src={equipe.logo} alt={equipe.designation} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-waterloo">Aucune image</div>
                      )}
                    </div>

                    <div className="mt-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-semibold text-black dark:text-white">{equipe.designation}</h3>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {equipe.metriques?.competitions || 0} comp.
                        </span>
                      </div>

                      <p className="line-clamp-3 text-sm text-waterloo">
                        {equipe.description?.[0] || "Cette équipe n’a pas encore de description détaillée."}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-alabaster px-3 py-1 text-xs font-medium text-black dark:bg-strokedark dark:text-white">
                          Capitaine: {equipe.chefId?.userId?.pseudo || "À définir"}
                        </span>
                        <span className="rounded-full bg-alabaster px-3 py-1 text-xs font-medium text-black dark:bg-strokedark dark:text-white">
                          {equipe.membres?.length || 1} membre{(equipe.membres?.length || 1) > 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-t border-stroke pt-3 text-sm text-waterloo dark:border-strokedark">
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          {equipe.payment?.[0]?.status === "CONFIRMED" ? "Inscription confirmée" : "En attente de validation"}
                        </span>
                        <span className="font-medium text-black dark:text-white">{equipe.metriques?.matchsWin || 0} victoires</span>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>

              {filteredEquipes.length === 0 && (
                <div className="rounded-2xl border border-dashed border-stroke bg-white p-8 text-center text-waterloo dark:border-strokedark dark:bg-blacksection">
                  Aucune équipe ne correspond à votre recherche pour le moment.
                </div>
              )}
            </div>

            <aside className="rounded-3xl border border-stroke bg-white p-6 shadow-solid-8 dark:border-strokedark dark:bg-blacksection">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-black dark:text-white">Créer votre équipe</h3>
                  <p className="text-sm text-waterloo">Inscription en 3 étapes simples.</p>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex flex-1 items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${step >= item ? "bg-primary text-white" : "bg-alabaster text-waterloo dark:bg-strokedark dark:text-white"}`}>
                      {item}
                    </div>
                    {item < 3 && <div className={`h-0.5 flex-1 ${step > item ? "bg-primary" : "bg-stroke dark:bg-strokedark"}`} />}
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                  <p className="font-semibold">Montant d’inscription</p>
                  <p>1 USD soit 2 500 CDF</p>
                </div>
                {message ? <div className="rounded-xl border border-meta/30 bg-meta/10 p-3 text-sm text-black dark:text-white">{message}</div> : null}
                {error ? <div className="rounded-xl border border-red-400/30 bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}
              </div>

              {step === 1 && (
                <div className="mt-6 space-y-4">
                  <p className="text-sm text-waterloo">Commencez par trouver le capitaine à partir du compte joueur.</p>
                  <SearchUserInput onSelect={handleCaptainSelect} label="Rechercher le capitaine" />
                  {captain ? (
                    <div className="rounded-xl border border-stroke bg-alabaster p-4 dark:border-strokedark dark:bg-strokedark">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-black dark:text-white">{captain.pseudo}</p>
                          <p className="text-sm text-waterloo">{captain.telephone}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {step === 2 && captain ? (
                <form className="mt-6 space-y-4" onSubmit={handleInitiate}>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-black dark:text-white">Désignation</label>
                    <input
                      value={design}
                      onChange={(event) => setDesign(event.target.value)}
                      placeholder="Nom de l’équipe"
                      className="w-full rounded-xl border border-stroke bg-transparent px-4 py-3 text-sm text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-black dark:text-white">Description</label>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Décrivez votre équipe"
                      className="min-h-24 w-full rounded-xl border border-stroke bg-transparent px-4 py-3 text-sm text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-black dark:text-white">Logo</label>
                    <input
                      value={logo}
                      onChange={(event) => setLogo(event.target.value)}
                      placeholder="URL du logo ou chemin public"
                      className="w-full rounded-xl border border-stroke bg-transparent px-4 py-3 text-sm text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-black dark:text-white">Téléphone du capitaine</label>
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="243XXXXXXXXX"
                      className="w-full rounded-xl border border-stroke bg-transparent px-4 py-3 text-sm text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? "Traitement…" : "Initier le paiement"}
                  </button>
                </form>
              ) : null}

              {step === 3 && captain ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-xl border border-stroke bg-alabaster p-4 dark:border-strokedark dark:bg-strokedark">
                    <div className="flex items-center gap-2 text-primary">
                      <CreditCard className="h-4 w-4" />
                      <p className="font-semibold">Vérification du paiement</p>
                    </div>
                    <p className="mt-2 text-sm text-waterloo">Commande : {orderNumber || "En attente"}</p>
                    <p className="text-sm text-waterloo">Montant : 2 500 CDF (1 USD)</p>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleConfirm}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? "Vérification…" : "Confirmer le paiement"}
                  </button>
                </div>
              ) : null}

              {step === 1 && !captain ? (
                <div className="mt-6 rounded-xl border border-dashed border-stroke p-4 text-sm text-waterloo dark:border-strokedark">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-primary" />
                    Le capitaine est recherché par pseudo ou téléphone avant l’inscription.
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
