import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f2fbfb",
          100: "#e6f7f6",
          200: "#ccefe9",
          300: "#99e0d3",
          400: "#4fd0ba",
          500: "#12b3a3",
          600: "#0f9a88",
          700: "#0c6f62",
          800: "#0a4f47",
          900: "#063934",
        },
        accent: {
          gold: "#f6c85f",
          mint: "#7ef0d6",
          red: "#ef4444",
        },
        surface: {
          DEFAULT: "#0f0f14",
          card: "#1a1a24",
          hover: "#24243a",
          border: "#2e2e48",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Poppins", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "navbar": "0 0 16px 16px",
      },
    },
  },
  plugins: [],
};

export default config;
