import { parse } from "../vendor/fastparse/index.js";

export function loadConfig(text) {
  return parse(text, { strict: true });
}
