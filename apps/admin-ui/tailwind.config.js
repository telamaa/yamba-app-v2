const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // D84 — la variable posée par `next/font` dans `src/app/layout.tsx`.
      // Sans cette ligne, `font-sans` émet la pile par défaut de Tailwind et
      // la police est chargée pour rien (le défaut constaté sur user-ui).
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
