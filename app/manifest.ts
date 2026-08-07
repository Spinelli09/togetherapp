import type { MetadataRoute } from "next";

// Makes "Add to Home Screen" produce a real app entry — named icon,
// standalone window, no browser chrome — rather than a shortcut labelled
// with the URL. Colours match the app's light theme, which is the only
// theme currently active (globals.css gates dark behind a .dark class
// nothing sets).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Together",
    short_name: "Together",
    description: "Shared finances for two.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
