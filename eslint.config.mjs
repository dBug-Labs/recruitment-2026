import coreWebVitals from "eslint-config-next/core-web-vitals";

/** Next 16 dropped `next lint`, so linting runs through the ESLint CLI: `npm run lint`. */
const config = [
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"] },
  ...coreWebVitals,
];

export default config;
