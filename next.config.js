/** @type {import('next').NextConfig} */

// En-têtes de sécurité (EX-SEC-06). Pas de CSP complète pour l'instant : KaTeX, MathLive et les
// redirections FlexPay doivent d'abord être inventoriés.
// TODO: définir une Content-Security-Policy complète après inventaire des scripts et domaines tiers.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
  images: {
    // Proxy d'images limité à Cloudinary (plus de proxy ouvert "**" en http et https).
    // TODO: ajouter ici tout autre domaine réellement utilisé par des images déjà enregistrées en base.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
