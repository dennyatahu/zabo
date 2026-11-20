import { createEvalPlugin } from "../../lib/create-eval-plugin.js";

export default createEvalPlugin({
  name: "eval async",
  trigger: "!!",
  wrap: (code) => `(async () => { ${code} })()`,
});
