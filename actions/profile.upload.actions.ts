"use server";

import { v2 as cloudinary } from "cloudinary";

// Configuration de Cloudinary avec les variables d'environnement
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

/**
 * Types d'image acceptés pour l'upload de profil
 */
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo

/**
 * Upload une image de profil vers Cloudinary, dans le dossier dédié aux profils.
 * Utilise upload_stream (chunked) pour supporter les fichiers volumineux.
 * Fonctionne via FormData comme le reste du projet.
 *
 * @param formData - FormData contenant le fichier sous la clé 'file'
 * @returns L'URL Cloudinary sécurisée et le public_id
 */
export async function uploadProfileImageToCloudinary(
  formData: FormData
): Promise<{ success: true; url: string; publicId: string } | { success: false; error: string }> {
  try {
    const file = formData.get("file") as File;

    if (!file || file.size === 0) {
      return { success: false, error: "Aucun fichier fourni ou fichier vide." };
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return {
        success: false,
        error:
          "Format d'image non supporté. Formats acceptés : JPG, PNG, WebP.",
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
          error:
            "L'image est trop volumineuse. Taille maximum : 10 Mo.",
      };
    }

    // TODO: ajouter une compression serveur des images avant upload si nécessaire.

    // Conversion en Buffer pour l'upload_stream
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload vers Cloudinary via upload_stream (gère le chunking automatiquement)
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "elmes-quiz/users/profiles",
          resource_type: "image",
          transformation: [
            { quality: "auto:good", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    if (!uploadResult || !uploadResult.secure_url) {
      return {
        success: false,
        error: "Réponse Cloudinary incomplète. Veuillez réessayer.",
      };
    }

    return {
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    };
  } catch (error: any) {
    console.error("[UPLOAD PROFILE IMAGE ERROR]", error);
    return {
      success: false,
      error:
        error?.message ||
        "Erreur lors de l'upload de l'image. Veuillez réessayer.",
    };
  }
}