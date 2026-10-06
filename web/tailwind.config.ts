import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#050b1a",
          900: "#0a1330",
          800: "#0f1d45",
          700: "#16295c",
          600: "#22397a",
        },
        brand: {
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
        },
      },
      fontFamily: {
        sans: ["var(--font-noto)", "system-ui", "sans-serif"],
        num: ["var(--font-inter)", "var(--font-noto)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(34,197,94,0.45)",
      },
      keyframes: {
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
        fadeUp: "fadeUp 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
