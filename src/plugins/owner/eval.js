// Eval plugin (!): evaluate JavaScript in the bot process. Owner-only, bypassPrefix.
// Created via createEvalPlugin from lib/eval/create-eval-plugin.js.

import { createEvalPlugin } from "../../lib/eval/create-eval-plugin.js";

export default createEvalPlugin({ name: "eval", trigger: "!" });
