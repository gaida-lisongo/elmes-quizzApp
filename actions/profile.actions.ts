"use server";

import { getSession, setSessionCookie } from "@/lib/utils/auth";
import connectToDb from "@/lib/utils/db";
import User from "@/lib/models/User";
import Player from "@/lib/models/Player";
import { hashPassword, validateNewPassword, verifyPassword } from "@/lib/utils/password";

const CLOUDINARY_URL_PATTERN = /^https:\/\/res\.cloudinary\.com\//;

/**
 * Change le mot de passe de l'utilisateur connecté : vérifie l'ancien, écrit l'empreinte scrypt,
 * incrémente sessionVersion (révoque les autres sessions) puis renouvelle le cookie courant.
 */
async function changeOwnPassword(userId: string, oldPassword: string, newPassword: string) {
  const passwordError = validateNewPassword(newPassword);
  if (passwordError) return { success: false, error: passwordError };

  const user = await User.findById(userId).select("+secure");
  if (!user || !user.secure) {
    return { success: false, error: "Utilisateur introuvable." };
  }

  const { valid } = await verifyPassword(oldPassword, user.secure);
  if (!valid) {
    return { success: false, error: "Ancien mot de passe incorrect." };
  }

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: { secure: await hashPassword(newPassword) }, $inc: { sessionVersion: 1 } },
    { new: true },
  ).lean();
  if (updated) {
    await setSessionCookie(String(updated._id), updated.role, updated.sessionVersion ?? 0);
  }
  return { success: true };
}

/**
 * Met à jour l'identité du profil (pseudo, email, école si PLAYER).
 */
export async function updateProfileIdentity(formData: FormData) {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Vous devez être connecté pour effectuer cette action." };
    }

    await connectToDb();

    const pseudo = String(formData.get("pseudo") || "");
    const email = String(formData.get("email") || "");
    const school = String(formData.get("school") || "");

    // Validation
    if (!pseudo.trim()) {
      return { success: false, error: "Le pseudo ne peut pas être vide." };
    }

    // Mise à jour du document User
    const updateData: Record<string, string> = {
      pseudo: pseudo.trim(),
    };
    if (email.trim()) {
      updateData.email = email.trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
      session.userId,
      { $set: updateData },
      { new: true }
    );

    if (!updatedUser) {
      return { success: false, error: "Utilisateur introuvable." };
    }

    // Si le rôle est PLAYER, mettre à jour l'école dans le document Player
    if (updatedUser.role === "PLAYER" && school.trim()) {
      await Player.findOneAndUpdate(
        { userId: session.userId },
        { $set: { school: school.trim() } }
      );
    }

    return { success: true, message: "Profil mis à jour avec succès." };
  } catch (error: any) {
    console.error("[updateProfileIdentity]", error);
    return { success: false, error: error.message || "Erreur lors de la mise à jour du profil." };
  }
}

/**
 * Met à jour le mot de passe après vérification de l'ancien.
 */
export async function updateProfilePassword(formData: FormData) {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Vous devez être connecté pour effectuer cette action." };
    }

    await connectToDb();

    const oldPassword = String(formData.get("oldPassword") || "");
    const newPassword = String(formData.get("newPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    // Validations
    if (!oldPassword || !newPassword || !confirmPassword) {
      return { success: false, error: "Tous les champs mot de passe sont obligatoires." };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: "La confirmation du mot de passe ne correspond pas." };
    }

    const result = await changeOwnPassword(session.userId, oldPassword, newPassword);
    if (!result.success) return result;

    return { success: true, message: "Mot de passe mis à jour avec succès." };
  } catch (error: any) {
    console.error("[updateProfilePassword]", error?.message);
    return { success: false, error: "Erreur lors de la mise à jour du mot de passe." };
  }
}

/**
 * Met à jour la photo de profil depuis une URL Cloudinary.
 */
export async function updateProfilePhoto(cloudinaryUrl: string) {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Vous devez être connecté pour effectuer cette action." };
    }

    if (typeof cloudinaryUrl !== "string" || !CLOUDINARY_URL_PATTERN.test(cloudinaryUrl.trim())) {
      return { success: false, error: "L'URL de la photo est invalide." };
    }

    await connectToDb();

    const updatedUser = await User.findByIdAndUpdate(
      session.userId,
      { $set: { photo: cloudinaryUrl.trim() } },
      { new: true }
    );

    if (!updatedUser) {
      return { success: false, error: "Utilisateur introuvable." };
    }

    return { success: true, message: "Photo de profil mise à jour avec succès." };
  } catch (error: any) {
    console.error("[updateProfilePhoto]", error);
    return { success: false, error: error.message || "Erreur lors de la mise à jour de la photo." };
  }
}

/**
 * Mise à jour de son propre compte depuis le tiroir de profil (tous rôles).
 * Le rôle n'est jamais modifiable ici ; le changement de mot de passe exige l'ancien.
 */
export async function updateMyAccountAction(data: {
  pseudo?: string;
  telephone?: string;
  email?: string;
  photo?: string;
  currentPassword?: string;
  newPassword?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Vous devez être connecté pour effectuer cette action." };
    }

    await connectToDb();

    const updateData: Record<string, string> = {};
    if (typeof data?.pseudo === "string" && data.pseudo.trim()) updateData.pseudo = data.pseudo.trim();
    if (typeof data?.email === "string" && data.email.trim()) updateData.email = data.email.trim().toLowerCase();
    if (typeof data?.photo === "string" && data.photo.trim()) {
      if (!CLOUDINARY_URL_PATTERN.test(data.photo.trim())) {
        return { success: false, error: "L'URL de la photo est invalide." };
      }
      updateData.photo = data.photo.trim();
    }
    if (typeof data?.telephone === "string" && data.telephone.trim()) {
      const telephone = data.telephone.trim();
      const existing = await User.findOne({ telephone, _id: { $ne: session.userId } }).lean();
      if (existing) return { success: false, error: "Ce numéro de téléphone est déjà utilisé." };
      updateData.telephone = telephone;
    }

    if (Object.keys(updateData).length > 0) {
      await User.updateOne({ _id: session.userId }, { $set: updateData });
    }

    if (data?.newPassword) {
      const result = await changeOwnPassword(session.userId, String(data.currentPassword || ""), String(data.newPassword));
      if (!result.success) return result;
    }

    return { success: true, message: "Profil mis à jour avec succès." };
  } catch (error: any) {
    console.error("[updateMyAccountAction]", error?.message);
    return { success: false, error: "Erreur lors de la mise à jour du profil." };
  }
}
