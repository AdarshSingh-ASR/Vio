import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // These React 19 advisory rules require a separate, application-wide state
    // refactor. Keep established subscription/loading effects valid for now.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "public/output.css", "services/**"]),
]);
