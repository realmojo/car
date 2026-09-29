import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".open-next/**",
    // Supabase Edge Function (Deno)
    "supabase/**",
  ]),
  {
    rules: {
      // 내부 이동도 <a target="_self"> 로 통일해 매번 새로 로드시킨다 (키워드에그와 동일)
      "@next/next/no-html-link-for-pages": "off",
      // 네이버 애널리틱스는 동기 스크립트로 넣어야 wcs_do() 가 동작한다 (키워드에그와 동일)
      "@next/next/no-sync-scripts": "off",
    },
  },
]);

export default eslintConfig;
