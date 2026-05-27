import * as fs from "fs";
import type { SessionMeta } from "@relay-baton/shared";

export function readSessionMeta(file: string): SessionMeta | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as SessionMeta;
  } catch {
    return null;
  }
}

export function writeSessionMeta(file: string, meta: SessionMeta) {
  meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(meta, null, 2), "utf8");
}
