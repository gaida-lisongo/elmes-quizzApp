"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { uploadToCloudinary } from "@/actions/cloudinary.actions";

interface ImageUploaderProps {
  onUploadComplete: (url: string) => void;
  currentImage?: string;
  label?: string;
}

const ImageUploader = ({
  onUploadComplete,
  currentImage,
  label = "Image",
}: ImageUploaderProps) => {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation taille
    if (file.size > MAX_SIZE) {
      setError("Le fichier ne doit pas dépasser 10 Mo.");
      return;
    }

    // Validation type
    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image.");
      return;
    }

    setError(null);

    // Afficher un aperçu local immédiat
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    // Upload vers Cloudinary
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadToCloudinary(formData);

      if (!result.success) {
        throw new Error(result.error || "Échec de l'upload");
      }

      onUploadComplete(result.url);
      setPreview(result.url);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'upload");
      setPreview(currentImage || null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <label className="mb-2 block text-sm font-medium text-black dark:text-white">
        {label}
      </label>

      {/* Zone de drop / preview */}
      <div
        onClick={() => inputRef.current?.click()}
        className="relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-stroke p-4 transition hover:border-primary dark:border-strokedark dark:hover:border-primary"
      >
        {preview ? (
          <div className="relative h-40 w-full">
            <Image
              src={preview}
              alt="Aperçu"
              fill
              className="rounded-lg object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition hover:opacity-100">
              <span className="text-sm text-white">Changer l&apos;image</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-waterloo"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-sm text-waterloo">
              Cliquez pour sélectionner une image
            </span>
            <span className="text-xs text-manatee">Max 10 Mo</span>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {uploading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-sm text-primary"
        >
          Upload en cours...
        </motion.div>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-sm text-red-500"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
};

export default ImageUploader;