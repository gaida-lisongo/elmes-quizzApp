import Image from "next/image";
import { motion } from "framer-motion";

interface TeamMember {
  name: string;
  role: string;
  imageUrl: string;
  bio: string;
}

const SingleTeam = ({ member }: { member: TeamMember }) => {
  const { name, role, imageUrl, bio } = member;

  return (
    <div className="group relative overflow-hidden rounded-lg shadow-solid-9 dark:border dark:border-strokedark dark:shadow-none">
      {/* Photo en fond */}
      <div className="relative aspect-[3/4] w-full">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-stroke dark:bg-strokedark">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-waterloo">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}

        {/* Overlay dégradé du bas vers le haut */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

        {/* Contenu sur l'overlay - toujours visible */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="mb-1 text-xl font-bold text-white">
            {name}
          </h3>
          <p className="mb-2 text-sm font-medium text-primary">{role}</p>
          {bio && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="text-sm leading-relaxed text-gray-200 whitespace-pre-line"
            >
              {bio}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SingleTeam;