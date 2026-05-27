import * as fs from "fs";
import * as path from "path";
import { deterministicCompress } from "@relay-baton/core";

export async function compressCommand(file: string, opts: { write?: boolean; out?: string }) {
  const repoRoot = process.cwd();
  const target = path.isAbsolute(file) ? file : path.join(repoRoot, file);
  if (!fs.existsSync(target)) {
    console.error(`file not found: ${target}`);
    process.exit(2);
  }
  const src = fs.readFileSync(target, "utf8");
  const out = deterministicCompress(src);
  if (opts.out) {
    fs.writeFileSync(opts.out, out, "utf8");
    console.log(`[relay-baton] wrote ${opts.out} (${src.length} -> ${out.length} chars)`);
  } else if (opts.write) {
    fs.writeFileSync(target, out, "utf8");
    console.log(`[relay-baton] rewrote ${target} (${src.length} -> ${out.length} chars)`);
  } else {
    process.stdout.write(out);
    process.stderr.write(`\n[relay-baton] preview only (${src.length} -> ${out.length} chars). Use --write or --out.\n`);
  }
}
