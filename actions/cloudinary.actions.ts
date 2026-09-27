"use server";

import { v2 as cloudinary } from "cloudinary";
import { guardSession } from "@/lib/utils/guards";

// Configuration de Cloudinary avec les variables d'environnement
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// Mêmes limites que l'upload de photo de profil (profile.upload.actions.ts).
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo

/**
 * Server Action pour uploader un fichier (Image ou PDF) sur Cloudinary
 * - session exigée ; images JPG/PNG/WebP pour tous, PDF réservé au staff ; 10 Mo maximum.
 * @param formData Objet FormData contenant le fichier sous la clé 'file'
 * @returns L'URL publique du fichier sur Cloudinary
 */
export async function uploadToCloudinary(formData: FormData) {
  try {
    const guard = await guardSession();
    if (!guard.ok) return { success: false, error: guard.error };

    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Aucun fichier n'a été fourni ou le fichier est vide.");
    }

    // 1. Détecter le type de ressource (image ou document/pdf)
    const isPdf = file.type === "application/pdf";
    const isStaff = ["ADMIN", "MOD"].includes(guard.session.role);
    if (!ALLOWED_IMAGE_TYPES.has(file.type) && !(isPdf && isStaff)) {
      return { success: false, error: "Format non supporté. Formats acceptés : JPG, PNG, WebP." };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: "Le fichier est trop volumineux. Taille maximum : 10 Mo." };
    }
    const resourceType = isPdf ? "raw" : "image";

    // 2. Convertir le fichier en Buffer puis en ArrayBuffer pour Node.js
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Upload vers Cloudinary en utilisant un Promise Wrapper (requis pour les flux/buffers)
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "centre_recherche", // Dossier d'organisation dans Cloudinary
          resource_type: resourceType,
          // Si c'est un PDF, on force l'extension originale pour que l'URL soit propre
          format: isPdf ? "pdf" : undefined,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      // Écriture du buffer dans le flux d'upload
      uploadStream.end(buffer);
    });

    // 4. Retourner l'URL sécurisée (https)
    return {
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id
    };

  } catch (error: any) {
    console.error("[CLOUDINARY UPLOAD ERROR] :", error?.message);
    return { success: false, error: error.message || "Échec de l'upload" };
  }
}
