import type { MetadataRoute } from "next";
import { getMessages } from "@/i18n";

export default function manifest(): MetadataRoute.Manifest {
  const t = getMessages();
  return {
    name: t.app.name,
    short_name: t.app.name,
    description: t.app.tagline,
    lang: "fr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f6f4",
    theme_color: "#0f6b4f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
