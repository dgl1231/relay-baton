import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// The desktop webview ships its own i18n table (STRINGS) and tags DOM nodes with
// data-i18n* attributes. v2.0 "stable desktop contract" requires i18n parity:
// every language must cover the same keys, and every key referenced in the HTML
// must exist. This test enforces that contract.
const HTML_PATH = path.resolve(__dirname, "../../../../desktop/ui/index.html");
const LANGS = ["en", "ko", "ja", "zh"] as const;

function langKeys(html: string, lang: string): string[] {
  const lines = html.split(/\r?\n/);
  const start = lines.findIndex(l => l === `        ${lang}: {`);
  if (start === -1) throw new Error(`language block not found: ${lang}`);
  const keys: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^        \},?$/.test(lines[i])) break; // end of this language block
    const m = /^          ([A-Za-z0-9_]+):/.exec(lines[i]);
    if (m) keys.push(m[1]);
  }
  return keys;
}

describe("desktop i18n parity", () => {
  const html = fs.readFileSync(HTML_PATH, "utf8");
  const keysByLang = Object.fromEntries(LANGS.map(l => [l, langKeys(html, l)])) as Record<string, string[]>;

  it("every language defines a non-trivial string table", () => {
    for (const lang of LANGS) expect(keysByLang[lang].length).toBeGreaterThan(50);
  });

  it("ko/ja/zh cover exactly the same keys as en", () => {
    const en = new Set(keysByLang.en);
    for (const lang of LANGS.filter(l => l !== "en")) {
      const set = new Set(keysByLang[lang]);
      const missing = [...en].filter(k => !set.has(k));
      const extra = [...set].filter(k => !en.has(k));
      expect({ lang, missing, extra }).toEqual({ lang, missing: [], extra: [] });
    }
  });

  it("has no duplicate keys within a language", () => {
    for (const lang of LANGS) {
      const seen = new Set<string>();
      const dupes = keysByLang[lang].filter(k => (seen.has(k) ? true : (seen.add(k), false)));
      expect({ lang, dupes }).toEqual({ lang, dupes: [] });
    }
  });

  it("every data-i18n* key used in the HTML exists in the en table", () => {
    const en = new Set(keysByLang.en);
    const used = new Set<string>();
    for (const m of html.matchAll(/data-i18n(?:-title|-placeholder)?="([^"]+)"/g)) used.add(m[1]);
    const unknown = [...used].filter(k => !en.has(k));
    expect(unknown).toEqual([]);
  });
});
