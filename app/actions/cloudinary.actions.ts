"use server";

import { v2 as cloudinary } from "cloudinary";

// Configuration de Cloudinary avec les variables d'environnement
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

/**
 * Server Action pour uploader un fichier (Image ou PDF) sur Cloudinary
 * @param formData Objet FormData contenant le fichier sous la clé 'file'
 * @returns L'URL publique du fichier sur Cloudinary
 */
export async function uploadToCloudinary(formData: FormData) {
  try {
    const file = formData.get("file") as File;

    if (!file || file.size === 0) {
      throw new Error("Aucun fichier n'a été fourni ou le fichier est vide.");
    }

    // 1. Détecter le type de ressource (image ou document/pdf)
    const isPdf = file.type === "application/pdf";
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
    console.error("[CLOUDINARY UPLOAD ERROR] :", error);
    return { success: false, error: error.message || "Échec de l'upload" };
  }
}