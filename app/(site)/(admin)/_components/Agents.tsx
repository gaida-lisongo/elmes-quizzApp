"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAgents,
  createAgent,
  updateAgentPermissions,
  deleteAgentAndUser,
  updateUser,
} from "@/app/actions/user.actions";

/* ================================================================
   Types
   ================================================================ */
interface AgentUser {
  _id: string;
  pseudo: string;
  telephone: string;
  email?: string;
  role: string;
  solde: number;
}

interface AgentItem {
  _id: string;
  userId: AgentUser;
  permissions: string[];
  retraits: any[];
  tickets: any[];
}

const EMPTY_USER_FORM = {
  pseudo: "",
  telephone: "",
  email: "",
  role: "MOD" as "PLAYER" | "MOD" | "ADMIN",
  secure: "",
};

const PERMISSIONS_LIST = [
  { value: "HOME", label: "Accueil (édition)" },
  { value: "PARCOURS", label: "Parcours" },
  { value: "COMPETITIONS", label: "Compétitions" },
  { value: "ABOUT", label: "À propos" },
  { value: "EQUIPES", label: "Équipes" },
];

/* ================================================================
   Modal 3 étapes
   ================================================================ */
const AgentCreateModal = ({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [step, setStep] = useState(1);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [createdAgent, setCreatedAgent] = useState<AgentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateUserField = (field: keyof typeof EMPTY_USER_FORM, value: string) => {
    setUserForm((prev) => ({ ...prev, [field]: value }));
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  /* Étape 1 → Créer User + Agent */
  const handleStep1Create = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await createAgent({
        pseudo: userForm.pseudo,
        telephone: userForm.telephone,
        email: userForm.email || undefined,
        role: userForm.role,
        secure: userForm.secure,
      });

      if (!result.success) throw new Error(result.error);

      setCreatedAgent(result.data);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  /* Étape 2 → Assigner permissions */
  const handleStep2Save = async () => {
    if (!createdAgent) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateAgentPermissions(
        createdAgent._id,
        selectedPermissions
      );
      if (!result.success) throw new Error(result.error);

      setCreatedAgent(result.data);
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'assignation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-99999 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-solid-4 dark:bg-blacksection"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-black dark:text-white">
            Créer un agent
          </h3>
          <button onClick={onClose} className="text-waterloo hover:text-black dark:hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Stepper 3 étapes */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  step === s ? "bg-primary text-white" : step > s ? "bg-meta text-white" : "bg-stroke text-manatee dark:bg-strokedark"
                }`}
              >
                {s}
              </div>
              {s < 3 && <div className={`h-0.5 flex-1 ${step > s ? "bg-meta" : "bg-stroke dark:bg-strokedark"}`} />}
            </div>
          ))}
        </div>

        {/* Étape 1: Données User */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Pseudo</label>
                <input type="text" value={userForm.pseudo} onChange={(e) => updateUserField("pseudo", e.target.value)} placeholder="Pseudo"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Téléphone</label>
                <input type="text" value={userForm.telephone} onChange={(e) => updateUserField("telephone", e.target.value)} placeholder="+243..."
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Email</label>
                <input type="email" value={userForm.email} onChange={(e) => updateUserField("email", e.target.value)} placeholder="email@ex.com"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Rôle</label>
                <select value={userForm.role} onChange={(e) => updateUserField("role", e.target.value)}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white">
                  <option value="MOD">Modérateur</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Mot de passe</label>
                <input type="password" value={userForm.secure} onChange={(e) => updateUserField("secure", e.target.value)} placeholder="••••••••"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
              </div>
            </div>
          </div>
        )}

        {/* Étape 2: Permissions Agent */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-waterloo">
              Agent <strong className="text-black dark:text-white">{createdAgent?.userId?.pseudo}</strong> créé. Choisissez ses permissions&nbsp;:
            </p>
            <div className="space-y-2">
              {PERMISSIONS_LIST.map((perm) => (
                <label key={perm.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-stroke p-3 transition hover:bg-zumthor dark:border-strokedark dark:hover:bg-blackho">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm.value)}
                    onChange={() => togglePermission(perm.value)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm text-black dark:text-white">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Étape 3: Résumé */}
        {step === 3 && createdAgent && (
          <div className="space-y-4">
            <div className="rounded-lg border border-stroke bg-green-50 p-4 text-center text-sm text-green-700 dark:border-strokedark dark:bg-green-900/20 dark:text-green-400">
              ✓ Agent créé avec succès
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-waterloo">Pseudo</span><span className="font-medium text-black dark:text-white">{createdAgent.userId.pseudo}</span></div>
              <div className="flex justify-between"><span className="text-waterloo">Téléphone</span><span>{createdAgent.userId.telephone}</span></div>
              <div className="flex justify-between"><span className="text-waterloo">Rôle</span><span className="font-medium text-primary">{createdAgent.userId.role}</span></div>
              <div className="flex justify-between"><span className="text-waterloo">Permissions</span><span>{createdAgent.permissions.length > 0 ? createdAgent.permissions.join(", ") : "Aucune"}</span></div>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        {/* Actions */}
        <div className="mt-6 flex justify-between">
          <div>
            {step > 1 && step < 3 && (
              <button onClick={() => setStep((s) => s - 1)} className="rounded-lg border border-stroke px-4 py-2 text-sm text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark">
                ← Retour
              </button>
            )}
            {step === 3 && (
              <button onClick={onClose} className="rounded-lg border border-stroke px-4 py-2 text-sm text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark">
                Fermer
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {step < 3 && (
              <button onClick={onClose} className="rounded-lg border border-stroke px-4 py-2 text-sm text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark">
                Annuler
              </button>
            )}
            {step === 1 && (
              <button onClick={handleStep1Create} disabled={saving || !userForm.pseudo || !userForm.telephone || !userForm.secure}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? "Création..." : "Créer l'agent →"}
              </button>
            )}
            {step === 2 && (
              <button onClick={handleStep2Save} disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? "Sauvegarde..." : "Valider →"}
              </button>
            )}
            {step === 3 && (
              <button onClick={() => { onSaved(); onClose(); }}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho">
                Terminé
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ================================================================
   Modal modification complète (User + Agent)
   ================================================================ */
const EditAgentModal = ({
  agent,
  onClose,
  onSaved,
}: {
  agent: AgentItem;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [userForm, setUserForm] = useState({
    pseudo: agent.userId?.pseudo || "",
    telephone: agent.userId?.telephone || "",
    email: agent.userId?.email || "",
    role: agent.userId?.role || "MOD",
    secure: "",
  });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(agent.permissions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof typeof userForm, value: string) => {
    setUserForm((prev) => ({ ...prev, [field]: value }));
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // 1. Mettre à jour l'utilisateur
      const userResult = await updateUser(agent.userId._id, {
        pseudo: userForm.pseudo,
        telephone: userForm.telephone,
        email: userForm.email || undefined,
        role: userForm.role as "PLAYER" | "MOD" | "ADMIN",
        secure: userForm.secure || undefined,
      });
      if (!userResult.success) throw new Error(userResult.error);

      // 2. Mettre à jour les permissions agent
      const permResult = await updateAgentPermissions(agent._id, selectedPermissions);
      if (!permResult.success) throw new Error(permResult.error);

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la modification");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-99999 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-solid-4 dark:bg-blacksection"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-black dark:text-white">
            Modifier — {agent.userId?.pseudo}
          </h3>
          <button onClick={onClose} className="text-waterloo hover:text-black dark:hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Infos utilisateur */}
        <div className="mb-6">
          <h4 className="mb-3 text-sm font-semibold uppercase text-waterloo">Informations utilisateur</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Pseudo</label>
              <input type="text" value={userForm.pseudo} onChange={(e) => updateField("pseudo", e.target.value)}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Téléphone</label>
              <input type="text" value={userForm.telephone} onChange={(e) => updateField("telephone", e.target.value)}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Email</label>
              <input type="email" value={userForm.email} onChange={(e) => updateField("email", e.target.value)}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Rôle</label>
              <select value={userForm.role} onChange={(e) => updateField("role", e.target.value)}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white">
                <option value="MOD">Modérateur</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">
                Nouveau mot de passe <span className="text-waterloo">(optionnel)</span>
              </label>
              <input type="password" value={userForm.secure} onChange={(e) => updateField("secure", e.target.value)} placeholder="Laisser vide pour conserver"
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div className="mb-6">
          <h4 className="mb-3 text-sm font-semibold uppercase text-waterloo">Permissions</h4>
          <div className="space-y-2">
            {PERMISSIONS_LIST.map((perm) => (
              <label key={perm.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-stroke p-3 transition hover:bg-zumthor dark:border-strokedark dark:hover:bg-blackho">
                <input type="checkbox" checked={selectedPermissions.includes(perm.value)}
                  onChange={() => togglePermission(perm.value)} className="h-4 w-4 accent-primary" />
                <span className="text-sm text-black dark:text-white">{perm.label}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-stroke px-4 py-2 text-sm text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ================================================================
   Composant principal Agents
   ================================================================ */
const Agents = () => {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [editAgent, setEditAgent] = useState<AgentItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    const result = await getAgents();
    if (result.success) {
      setAgents(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer définitivement cet agent et son compte utilisateur ?")) return;
    const result = await deleteAgentAndUser(id);
    if (result.success) {
      setAgents((prev) => prev.filter((a) => a._id !== id));
    }
  };

  const handleOpenEdit = (agent: AgentItem) => {
    setEditAgent(agent);
    setShowEditModal(true);
  };

  /* Filtre */
  const filtered = agents.filter((a) =>
    a.userId?.pseudo?.toLowerCase().includes(search.toLowerCase()) ||
    a.userId?.telephone?.includes(search)
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-black dark:text-white">Gestion des agents</h2>
          <p className="text-sm text-waterloo">{agents.length} agent(s) inscrit(s)</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2H9v6a1 1 0 1 1-2 0V9H1a1 1 0 0 1 0-2h6V1a1 1 0 0 1 1-1z" />
          </svg>
          Nouvel agent
        </button>
      </div>

      {/* Recherche */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par pseudo ou téléphone..."
          className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
        />
      </div>

      {/* Cartes */}
      {loading ? (
        <p className="text-center text-waterloo">Chargement...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="italic text-waterloo">
            {agents.length === 0 ? "Aucun agent pour le moment." : "Aucun résultat pour cette recherche."}
          </p>
          {agents.length === 0 && (
            <button onClick={() => setShowModal(true)} className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho">
              Créer le premier agent
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <div
              key={agent._id}
              className="rounded-xl bg-white p-5 shadow-solid-5 transition hover:shadow-solid-7 dark:border dark:border-strokedark dark:bg-blacksection dark:shadow-none"
            >
              {/* Avatar / Identité */}
              <div className="mb-4 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {agent.userId?.pseudo?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="truncate text-base font-semibold text-black dark:text-white">
                    {agent.userId?.pseudo || "—"}
                  </h3>
                  <p className="truncate text-sm text-waterloo">{agent.userId?.telephone || "—"}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  agent.userId?.role === "ADMIN"
                    ? "bg-primary/10 text-primary"
                    : "bg-meta/10 text-meta"
                }`}>
                  {agent.userId?.role || "—"}
                </span>
              </div>

              {/* Permissions */}
              <div className="mb-4">
                <p className="mb-1.5 text-xs font-medium uppercase text-waterloo">Permissions</p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.permissions.length > 0
                    ? agent.permissions.map((p) => (
                        <span key={p} className="rounded-md bg-zumthor px-2 py-0.5 text-xs text-black dark:bg-blackho dark:text-white">
                          {p}
                        </span>
                      ))
                    : <span className="text-xs italic text-manatee">Aucune</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenEdit(agent)}
                  className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-white transition hover:bg-primaryho"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(agent._id)}
                  className="flex-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs text-white transition hover:bg-red-600"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal création */}
      <AnimatePresence>
        {showModal && (
          <AgentCreateModal
            onClose={() => setShowModal(false)}
            onSaved={fetchAgents}
          />
        )}
      </AnimatePresence>

      {/* Modal modification */}
      <AnimatePresence>
        {showEditModal && editAgent && (
          <EditAgentModal
            agent={editAgent}
            onClose={() => setShowEditModal(false)}
            onSaved={fetchAgents}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Agents;