// const { createGlobPatternsForDependencies } = require('@nx/next/tailwind');

// The above utility import will not work if you are using Next.js' --turbo.
// Instead you will have to manually add the dependent paths to be included.
// For example
// ../libs/buttons/**/*.{ts,tsx,js,jsx,html}',                 <--- Adding a shared lib
// !../libs/buttons/**/*.{stories,spec}.{ts,tsx,js,jsx,html}', <--- Skip adding spec/stories files from shared lib

// If you are **not** using `--turbo` you can uncomment both lines 1 & 19.
// A discussion of the issue can be found: https://github.com/nrwl/nx/issues/26510

const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      /**
       * D84 — la police de marque, enfin BRANCHÉE.
       *
       * `next/font` charge Plus Jakarta Sans dans `src/app/layout.tsx` et
       * l'expose en variable `--font-sans` sur le `<html>`. Mais poser la
       * variable ne pose AUCUN `font-family` : c'est `plusJakarta.className`
       * qui le ferait, et ce n'est pas lui qu'on utilise. Sans la ligne
       * ci-dessous, l'utilitaire `font-sans` du `<body>` émettait donc la pile
       * PAR DÉFAUT de Tailwind — `ui-sans-serif, system-ui, sans-serif, …` —
       * et la police était téléchargée, préchargée, puis lue par une seule
       * règle du dépôt : celle de Leaflet. Le coût réseau sans l'identité.
       *
       * La pile système reste DERRIÈRE, et ce n'est pas décoratif : c'est ce
       * qui s'affiche pendant le `display: "swap"`, et ce qui reste si le
       * fichier de police ne part jamais.
       */
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  // `@tailwindcss/line-clamp` est intégré à Tailwind ≥ 3.3 (le plugin avertissait à chaque démarrage)
  plugins: [],
};
