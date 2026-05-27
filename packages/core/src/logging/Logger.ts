import * as fs from "fs";

export class Logger {
  private logFile?: string;

  constructor(logFile?: string) {
    this.logFile = logFile;
  }

  info(msg: string) {
    process.stdout.write(msg + "\n");
    this.append(msg);
  }
  warn(msg: string) {
    process.stderr.write("WARN: " + msg + "\n");
    this.append("WARN: " + msg);
  }
  error(msg: string) {
    process.stderr.write("ERROR: " + msg + "\n");
    this.append("ERROR: " + msg);
  }
  raw(msg: string) {
    this.append(msg);
  }

  private append(msg: string) {
    if (!this.logFile) return;
    try {
      fs.appendFileSync(this.logFile, msg + "\n", "utf8");
    } catch {
      // ignore
    }
  }
}
