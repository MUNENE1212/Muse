import { type Config } from "tailwindcss";

export default {
  content: [
    "{routes,islands,components}/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          "bg-dark": "#0C0B09", // Warm near-black
          "bg-light": "#fafafa",
          primary: "rgb(var(--muse-accent-rgb) / <alpha-value>)",
          "card-dark": "#141210", // Warm card surface
          "card-light": "#f3f4f6",
          teal: "#2A9D8F", // AI/mood accent
          "gold-dim": "#8C6D35", // Muted gold for subtle states
          accent: "#FF6B35", // Warm call-to-action accent (Capture modal)
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Newsreader", "ui-serif", "Georgia", "serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
} satisfies Config;
