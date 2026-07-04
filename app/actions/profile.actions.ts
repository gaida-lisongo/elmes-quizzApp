"use server";

import { getSession } from "@/lib/utils/auth";
import connectToDb from "@/app/lib/utils/db";
import User from "@/app/lib/models/User";
import Player from "@/app/lib/models/Player";
import { hashPassword } from "./user.actions";

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

    const pseudo = formData.get("pseudo") as string;
    const email = formData.get("email") as string;
    const school = formData.get("school") as string;

    // Validation
    if (!pseudo?.trim()) {
      return { success: false, error: "Le pseudo ne peut pas être vide." };
    }

    // Mise à jour du document User
    const updateData: Record<string, string> = {
      pseudo: pseudo.trim(),
    };
    if (email?.trim()) {
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
    if (updatedUser.role === "PLAYER" && school?.trim()) {
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

    const oldPassword = formData.get("oldPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    // Validations
    if (!oldPassword || !newPassword || !confirmPassword) {
      return { success: false, error: "Tous les champs mot de passe sont obligatoires." };
    }

    if (newPassword.length < 4) {
      return { success: false, error: "Le nouveau mot de passe doit contenir au moins 4 caractères." };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: "La confirmation du mot de passe ne correspond pas." };
    }

    // Récupérer l'utilisateur avec le champ secure (masqué par défaut)
    const user = await User.findById(session.userId).select("+secure");
    if (!user || !user.secure) {
      return { success: false, error: "Utilisateur introuvable." };
    }

    // Vérifier l'ancien mot de passe
    const hashedOldPassword = await hashPassword(oldPassword);
    if (user.secure !== hashedOldPassword) {
      return { success: false, error: "Ancien mot de passe incorrect." };
    }

    // Hacher et mettre à jour le nouveau mot de passe
    const hashedNewPassword = await hashPassword(newPassword);
    user.secure = hashedNewPassword;
    await user.save();

    return { success: true, message: "Mot de passe mis à jour avec succès." };
  } catch (error: any) {
    console.error("[updateProfilePassword]", error);
    return { success: false, error: error.message || "Erreur lors de la mise à jour du mot de passe." };
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

    if (!cloudinaryUrl?.trim()) {
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