// Eval async plugin (!!): evaluate JavaScript wrapped in an async function.
// Owner-only, bypassPrefix. Created via createEvalPlugin.

import { createEvalPlugin } from "../../lib/eval/create-eval-plugin.js";

export default createEvalPlugin({
  name: "eval async",
  trigger: "!!",
  wrap: (code) => `(async () => { ${code} })()`,
});
