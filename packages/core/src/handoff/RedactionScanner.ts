import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export type RedactionCategory = "secret" | "api-key" | "home-path" | "oversized";
export type RedactionSeverity = "high" | "medium";

export interface RedactionFinding {
  file: string;
  line: number | null;
  category: RedactionCategory;
  severity: RedactionSeverity;
  hint: string;
}

export interface RedactionReport {
  clean: boolean;
  findings: RedactionFinding[];
  byCategory: Record<RedactionCategory, number>;
}

interface Rule {
  category: RedactionCategory;
  severity: RedactionSeverity;
  re: RegExp;
  hint: string;
}

const RULES: Rule[] = [
  { category: "api-key", severity: "high", re: /\bsk-[A-Za-z0-9]{16,}\b/, hint: "OpenAI-style secret key" },
  { category: "api-key", severity: "high", re: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/, hint: "Anthropic-style secret key" },
  { category: "api-key", severity: "high", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, hint: "GitHub token" },
  { category: "api-key", severity: "high", re: /\bAKIA[0-9A-Z]{16}\b/, hint: "AWS access key id" },
  { category: "secret", severity: "high", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, hint: "private key block" },
  { category: "secret", severity: "medium", re: /\b(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN)\s*[:=]\s*\S+/, hint: "inline secret env assignment" },
];

const OVERSIZED_BYTES = 64 * 1024;

/**
 * Deterministic redaction scanner. Flags obvious secrets, API keys, absolute
 * home paths, and oversized files before a handoff bundle is shared. No model
 * calls — pattern matching only. It reports; it does not rewrite files.
 */
export class RedactionScanner {
  constructor(private readonly homeDir = os.homedir()) {}

  scanFiles(files: string[]): RedactionReport {
    const report: RedactionReport = {
      clean: true,
      findings: [],
      byCategory: { secret: 0, "api-key": 0, "home-path": 0, oversized: 0 },
    };
    for (const file of files) {
      let content = "";
      try {
        const stat = fs.statSync(file);
        if (stat.size > OVERSIZED_BYTES) {
          this.add(report, { file, line: null, category: "oversized", severity: "medium", hint: `${stat.size} bytes > ${OVERSIZED_BYTES}` });
        }
        content = fs.readFileSync(file, "utf8");
      } catch { continue; }
      this.scanText(report, file, content);
    }
    report.clean = report.findings.length === 0;
    return report;
  }

  scanText(report: RedactionReport, file: string, content: string): void {
    const lines = content.split(/\r?\n/);
    const homeAbs = this.homeDir.replace(/\\/g, "/");
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      for (const rule of RULES) {
        if (rule.re.test(raw)) this.add(report, { file, line: i + 1, category: rule.category, severity: rule.severity, hint: rule.hint });
      }
      // Absolute home paths leak the author's username/machine layout.
      if (homeAbs && (raw.includes(homeAbs) || raw.replace(/\\/g, "/").includes(homeAbs))) {
        this.add(report, { file, line: i + 1, category: "home-path", severity: "medium", hint: "absolute home path" });
      }
    }
  }

  private add(report: RedactionReport, finding: RedactionFinding) {
    report.findings.push(finding);
    report.byCategory[finding.category] += 1;
  }
}
