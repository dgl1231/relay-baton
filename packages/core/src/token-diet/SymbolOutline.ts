import * as fs from "fs";
import * as path from "path";

/**
 * v2.4 — deterministic compaction v2. Extract a compact symbol/heading outline
 * from a source file using language-aware regexes. No parser, no embeddings —
 * just stable line matching so the repo map can carry a structural outline of
 * the files that matter instead of only a flat directory tree.
 */

export interface FileOutline {
  file: string;
  symbols: string[];
}

const EXT_LANG: Record<string, "ts" | "py" | "cs" | "go" | "rust" | "java" | "md"> = {
  ".ts": "ts", ".tsx": "ts", ".js": "ts", ".jsx": "ts", ".mjs": "ts", ".cjs": "ts",
  ".py": "py",
  ".cs": "cs",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".md": "md", ".markdown": "md",
};

/** TS/JS top-level declarations (exported or not). */
const TS_PATTERNS: RegExp[] = [
  /^\s*export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/,
  /^\s*export\s+(?:abstract\s+)?class\s+([A-Za-z0-9_]+)/,
  /^\s*export\s+(?:interface|type|enum)\s+([A-Za-z0-9_]+)/,
  /^\s*export\s+const\s+([A-Za-z0-9_]+)/,
  /^\s*(?:async\s+)?function\s+([A-Za-z0-9_]+)/,
  /^\s*(?:abstract\s+)?class\s+([A-Za-z0-9_]+)/,
];

const PY_PATTERNS: RegExp[] = [
  /^\s*(?:async\s+)?def\s+([A-Za-z0-9_]+)/,
  /^\s*class\s+([A-Za-z0-9_]+)/,
];

const CS_PATTERNS: RegExp[] = [
  /^\s*(?:public|internal|private|protected|sealed|static|abstract|partial|\s)*\b(?:class|interface|struct|enum|record)\s+([A-Za-z0-9_]+)/,
];

const GO_PATTERNS: RegExp[] = [
  /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z0-9_]+)/,
  /^\s*type\s+([A-Za-z0-9_]+)\s+/,
];

const RUST_PATTERNS: RegExp[] = [
  /^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/,
  /^\s*(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z0-9_]+)/,
];

const JAVA_PATTERNS: RegExp[] = [
  /^\s*(?:public|private|protected|static|final|abstract|\s)*\b(?:class|interface|enum)\s+([A-Za-z0-9_]+)/,
];

function langPatterns(lang: string): RegExp[] {
  switch (lang) {
    case "ts": return TS_PATTERNS;
    case "py": return PY_PATTERNS;
    case "cs": return CS_PATTERNS;
    case "go": return GO_PATTERNS;
    case "rust": return RUST_PATTERNS;
    case "java": return JAVA_PATTERNS;
    default: return [];
  }
}

/** Extract an outline from file content. Markdown returns its headings. */
export function outlineContent(relPath: string, content: string, maxSymbols = 12): string[] {
  const ext = path.extname(relPath).toLowerCase();
  const lang = EXT_LANG[ext];
  if (!lang) return [];

  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  const seen = new Set<string>();

  if (lang === "md") {
    for (const line of lines) {
      const m = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
      if (!m) continue;
      const label = `${"#".repeat(m[1].length)} ${m[2].trim()}`;
      if (seen.has(label)) continue;
      seen.add(label);
      out.push(label);
      if (out.length >= maxSymbols) break;
    }
    return out;
  }

  const patterns = langPatterns(lang);
  for (const line of lines) {
    for (const re of patterns) {
      const m = re.exec(line);
      if (m && m[1] && !seen.has(m[1])) {
        seen.add(m[1]);
        out.push(m[1]);
        break;
      }
    }
    if (out.length >= maxSymbols) break;
  }
  return out;
}

/** Read + outline a repo-relative file; returns null when unreadable/empty. */
export function outlineFile(repoRoot: string, relPath: string, maxSymbols = 12): FileOutline | null {
  const abs = path.join(repoRoot, relPath);
  let content: string;
  try {
    const stat = fs.statSync(abs);
    if (!stat.isFile() || stat.size > 512 * 1024) return null; // skip huge/binary-ish files
    content = fs.readFileSync(abs, "utf8");
  } catch {
    return null;
  }
  const symbols = outlineContent(relPath, content, maxSymbols);
  if (symbols.length === 0) return null;
  return { file: relPath, symbols };
}
