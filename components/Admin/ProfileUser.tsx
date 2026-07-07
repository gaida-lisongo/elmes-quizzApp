"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Shield, Mail, Phone, Lock, Camera, Save,
  X, CheckCircle, AlertCircle, Loader2, ChevronRight,
  ArrowLeft, ImageIcon, QrCode, Sparkles, Copy, Link2,
} from "lucide-react";
import ShareLink from "@/components/Common/ShareLink";
import QRCode from "qrcode";
import { getCurrentUserDetailed } from "@/actions/auth.actions";
import { updateUser } from "@/actions/user.actions";
import { uploadToCloudinary } from "@/actions/cloudinary.actions";
import { logoutUser } from "@/actions/auth.actions";

/* ================================================================
   Types
   ================================================================ */
export interface CurrentUser {
  _id: string;
  pseudo: string;
  telephone: string;
  email?: string | null;
  photo?: string | null;
  solde: number;
  role: string;
  playerType?: string | null;
  referralCode?: string | null;
  profile?: {
    type: string;
    level?: number;
    parties?: number;
    school?: string;
    metrics?: { totalScore: number; partiesJouees: number; partiesGagnees: number };
    permissions?: string[];
  } | null;
}

/* ================================================================
   Drawer Profil (3 tabs)
   ================================================================ */
const ProfileDrawer = ({
  user,
  onClose,
  onSaved,
}: {
  user: CurrentUser;
  onClose: () => void;
  onSaved: (updated: CurrentUser) => void;
}) => {
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Tab 1: Identité
  const [pseudo, setPseudo] = useState(user.pseudo);
  const [role] = useState(user.role);

  // Tab 2: Mot de passe
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Tab 3: Coordonnées & Photo
  const [telephone, setTelephone] = useState(user.telephone);
  const [email, setEmail] = useState(user.email || "");
  const [photo, setPhoto] = useState(user.photo || "");
  const [uploading, setUploading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const tabs = ["Identité", "Mot de passe", "Coordonnées & Photo"];

  useEffect(() => {
    if (!user.referralCode) return;

    const referralUrl = `${window.location.origin}/auth/signup?code=${encodeURIComponent(user.referralCode)}`;
    QRCode.toDataURL(referralUrl, { width: 180, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [user.referralCode]);

  const resetSuccess = () => {
    setSuccess(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Validation mot de passe si on est sur le tab 2
      if (tab === 1) {
        if (newPassword && newPassword.length < 6) {
          throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
        }
        if (newPassword !== confirmPassword) {
          throw new Error("Les mots de passe ne correspondent pas.");
        }
      }

      const result = await updateUser(user._id, {
        pseudo: pseudo || undefined,
        telephone: telephone || undefined,
        email: email || undefined,
        secure: newPassword || undefined,
        role: role as "PLAYER" | "MOD" | "ADMIN",
      });

      if (!result.success) throw new Error(result.error);

      setSuccess(true);
      onSaved({ ...user, pseudo, telephone, email: email || null, photo: photo || null });
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadToCloudinary(formData);
      if (res.success && res.url) {
        setPhoto(res.url);
      }
    } catch {
      setError("Erreur lors du téléchargement de l'image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white shadow-solid-4 dark:bg-blacksection"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stroke bg-white px-6 py-4 dark:border-strokedark dark:bg-blacksection">
          <div className="flex items-center gap-3">
            <User className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-lg font-bold text-black dark:text-white">
                Mon profil
              </h3>
              <p className="text-xs text-waterloo">{user.pseudo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-stroke dark:hover:bg-strokedark"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Stepper tabs */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              {tabs.map((t, i) => (
                <div key={t} className="flex items-center gap-2 flex-1 last:flex-none">
                  <button
                    onClick={() => { resetSuccess(); setTab(i); }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
                      tab === i
                        ? "bg-primary text-white"
                        : tab > i
                        ? "bg-meta text-white"
                        : "bg-stroke text-manatee dark:bg-strokedark"
                    }`}
                  >
                    {i + 1}
                  </button>
                  <span className={`text-xs hidden sm:inline ${tab === i ? "text-primary font-medium" : "text-waterloo"}`}>
                    {t}
                  </span>
                  {i < tabs.length - 1 && (
                    <div className={`h-0.5 flex-1 ${tab > i ? "bg-meta" : "bg-stroke dark:bg-strokedark"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Tab 0: Identité */}
            {tab === 0 && (
              <motion.div
                key="tab0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-waterloo">
                  <Shield className="h-4 w-4" />
                  <h4 className="font-medium text-black dark:text-white">Identité</h4>
                </div>

                {/* Avatar */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                      {photo ? (
                        <img src={photo} alt="Avatar" className="h-20 w-20 rounded-full object-cover" />
                      ) : (
                        pseudo.charAt(0).toUpperCase()
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Pseudo</label>
                  <input
                    type="text"
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value)}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Rôle</label>
                  <div className="w-full rounded-lg border border-stroke bg-alabaster px-4 py-2.5 text-sm text-waterloo dark:border-strokedark dark:bg-strokedark">
                    {role}
                  </div>
                </div>

                {user.role === "PLAYER" && (
                  <div className="rounded-xl border border-stroke bg-alabaster p-4 dark:border-strokedark dark:bg-strokedark">
                    <div className="flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Lien d’affiliation
                    </div>
                    <p className="mt-2 text-sm text-waterloo">
                      Partagez votre lien et gagnez des parties supplémentaires à mesure que vos invités rejoignent la plateforme.
                    </p>

                    {user.referralCode ? (
                      <div className="mt-3 space-y-3">
                        <div className="rounded-lg border border-stroke bg-white p-3 text-sm dark:border-strokedark dark:bg-blacksection">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-waterloo">
                            <Link2 className="h-3.5 w-3.5" /> Code d’affiliation
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary">{user.referralCode}</span>
                            <ShareLink url={`${window.location.origin}/auth/signup?code=${encodeURIComponent(user.referralCode)}`} />
                          </div>
                        </div>
                        <div className="flex flex-col items-start gap-3 rounded-lg border border-stroke bg-white p-3 dark:border-strokedark dark:bg-blacksection sm:flex-row sm:items-center">
                          {qrDataUrl ? <img src={qrDataUrl} alt="QR code d’affiliation" className="h-24 w-24 rounded-lg border border-stroke p-1 dark:border-strokedark" /> : null}
                          <div className="text-sm text-waterloo">
                            <p className="font-medium text-black dark:text-white">QR code prêt</p>
                            <p>Scannez-le pour rejoindre votre réseau.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-dashed border-stroke p-3 text-sm text-waterloo dark:border-strokedark">
                        <p>Votre lien d’affiliation n’est pas encore disponible. Il sera généré lors de l’inscription.</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Tab 1: Mot de passe */}
            {tab === 1 && (
              <motion.div
                key="tab1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-waterloo">
                  <Lock className="h-4 w-4" />
                  <h4 className="font-medium text-black dark:text-white">Mot de passe</h4>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">
                    Confirmer le mot de passe
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez le mot de passe"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>

                <p className="text-xs text-waterloo italic">
                  Laissez vide si vous ne souhaitez pas changer de mot de passe.
                </p>
              </motion.div>
            )}

            {/* Tab 2: Coordonnées & Photo */}
            {tab === 2 && (
              <motion.div
                key="tab2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-waterloo">
                  <Mail className="h-4 w-4" />
                  <h4 className="font-medium text-black dark:text-white">Coordonnées & Photo</h4>
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-black dark:text-white">
                    <Phone className="h-3.5 w-3.5 text-primary" /> Téléphone
                  </label>
                  <input
                    type="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-black dark:text-white">
                    <Mail className="h-3.5 w-3.5 text-primary" /> Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>

                {/* Photo */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-black dark:text-white">
                    <Camera className="h-3.5 w-3.5 text-primary" /> Photo de profil
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary overflow-hidden">
                      {photo ? (
                        <img src={photo} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-8 w-8" />
                      )}
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stroke px-4 py-2 text-sm text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark">
                      <ImageIcon className="h-4 w-4" />
                      {uploading ? "Téléchargement..." : "Choisir une image"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadPhoto}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-600 dark:border-green-800 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Profil mis à jour avec succès !
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <div>
              {tab > 0 && (
                <button
                  onClick={() => { resetSuccess(); setTab(tab - 1); }}
                  className="flex items-center gap-2 rounded-lg border border-stroke px-4 py-2 text-sm text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark"
                >
                  <ArrowLeft className="h-4 w-4" /> Précédent
                </button>
              )}
            </div>
            <div className="flex gap-3">
              {tab < tabs.length - 1 ? (
                <button
                  onClick={() => { resetSuccess(); setTab(tab + 1); }}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho"
                >
                  Suivant <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm text-white transition hover:bg-primaryho disabled:opacity-50"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</>
                  ) : (
                    <><Save className="h-4 w-4" /> Enregistrer</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ================================================================
   Composant principal ProfileUser
   ================================================================ */
export default function ProfileUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const data = await getCurrentUserDetailed();
      if (data) setUser(data as CurrentUser);
    } catch {
      // Ignorer
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (loading || !user) return null;

  const handleLogout = async () => {
    await logoutUser();
    window.location.href = "/";
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Badge utilisateur cliquable */}
        <button
          onClick={() => setOpen(true)}
          className="flex flex-1 items-center gap-3 rounded-xl border border-stroke bg-white px-4 py-3 shadow-solid-5 transition hover:shadow-solid-7 dark:border-strokedark dark:bg-blacksection dark:shadow-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {user.photo ? (
              <img src={user.photo} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              user.pseudo.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-black dark:text-white">{user.pseudo}</p>
            <p className="text-xs text-waterloo">
              {user.playerType || user.role}
              {user.profile?.level !== undefined && ` · Niv. ${user.profile.level}`}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-waterloo" />
        </button>

        {user.playerType && user.playerType !== "ADMIN" && user.playerType !== "MOD" && (
          <div className="hidden xl:flex">
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-sm font-medium text-primary transition hover:bg-primary/10"
            >
              <QrCode className="h-4 w-4" />
              Affiliation
            </button>
          </div>
        )}

        {/* Bouton Déconnexion */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          title="Se déconnecter"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="hidden sm:inline">Déconnexion</span>
        </button>

        <AnimatePresence>
          {open && user && (
            <ProfileDrawer
              user={user}
              onClose={() => setOpen(false)}
              onSaved={(updated) => { setUser(updated); }}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}