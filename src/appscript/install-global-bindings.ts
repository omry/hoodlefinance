import { createHoodlefinanceAppScriptBindings } from "./index";

(globalThis as Record<string, unknown>).__hoodlefinanceBindings =
  createHoodlefinanceAppScriptBindings();
