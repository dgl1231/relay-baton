import { GitService } from "../git/GitService";

export type RiskCategory = "dependency" | "deletion" | "release" | "env-config" | "binary";
export type RiskSeverity = "high" | "medium";

export interface RiskFinding {
  path: string;
  code: string;
  category: RiskCategory;
  severity: RiskSeverity;
  reason: string;
}

export interface RiskReport {
  available: boolean;
  risky: boolean;
  findings: RiskFinding[];
  byCategory: Record<RiskCategory, number>;
  bySeverity: Record<RiskSeverity, number>;
}

const DEPENDENCY = [
  /(^|\/)package\.json$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)Cargo\.(toml|lock)$/,
  /(^|\/)go\.(mod|sum)$/,
  /(^|\/)requirements\.txt$/,
  /(^|\/)Pipfile(\.lock)?$/,
  /(^|\/)poetry\.lock$/,
  /(^|\/)Gemfile(\.lock)?$/,
];

const RELEASE = [
  /(^|\/)\.github\/workflows\//,
  /(^|\/)release-notes\//,
  /(^|\/)RELEASE\.md$/,
  /(^|\/)tauri\.conf\.json$/,
];

const ENV_CONFIG = [
  /(^|\/)\.env(\.|$)/,
  /(^|\/)\.npmrc$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /\.config\.(js|cjs|mjs|ts)$/,
  /(^|\/)\.(eslintrc|prettierrc|babelrc)[^/]*$/,
  /(^|\/)vite\.config\.[jt]s$/,
];

const BINARY_EXT = [
  ".exe", ".dll", ".so", ".dylib", ".bin", ".wasm", ".a", ".o",
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".icns", ".pdf", ".zip",
  ".gz", ".tar", ".jar", ".class", ".node", ".msi", ".dmg", ".appimage",
];

/**
 * Deterministic risk classifier for the guarded execution workflow. It flags
 * risky surfaces in the working-tree changes — dependency manifests, file
 * deletions, release/CI edits, env/config changes, and binary artifacts —
 * straight from the git status. Read-only, no model calls.
 */
export class RiskClassifier {
  constructor(private readonly repoRoot: string) {}

  evaluate(): RiskReport {
    const empty = (): RiskReport => ({
      available: false,
      risky: false,
      findings: [],
      byCategory: { dependency: 0, deletion: 0, release: 0, "env-config": 0, binary: 0 },
      bySeverity: { high: 0, medium: 0 },
    });

    const git = new GitService(this.repoRoot);
    if (!git.isGitRepo()) return empty();

    const report = empty();
    report.available = true;
    const files = git.summary(1000).files;

    for (const f of files) {
      const lower = f.path.toLowerCase();
      const deleted = f.code.includes("D");

      if (deleted) {
        this.add(report, { path: f.path, code: f.code, category: "deletion", severity: "high", reason: "file deleted" });
      }
      if (DEPENDENCY.some(re => re.test(f.path))) {
        this.add(report, { path: f.path, code: f.code, category: "dependency", severity: "medium", reason: "dependency manifest / lockfile change" });
      }
      if (RELEASE.some(re => re.test(f.path))) {
        this.add(report, { path: f.path, code: f.code, category: "release", severity: "medium", reason: "release / CI configuration change" });
      }
      if (ENV_CONFIG.some(re => re.test(f.path))) {
        this.add(report, { path: f.path, code: f.code, category: "env-config", severity: "medium", reason: "env / build configuration change" });
      }
      if (BINARY_EXT.some(ext => lower.endsWith(ext))) {
        this.add(report, { path: f.path, code: f.code, category: "binary", severity: "medium", reason: "binary / generated artifact change" });
      }
    }

    report.risky = report.findings.length > 0;
    return report;
  }

  private add(report: RiskReport, finding: RiskFinding) {
    report.findings.push(finding);
    report.byCategory[finding.category] += 1;
    report.bySeverity[finding.severity] += 1;
  }
}
