export function deterministicCompress(input: string): string {
  const lines = input.split(/\r?\n/);
  const out: string[] = [];
  let inCode = false;
  let blankRun = 0;
  let lastNonCode = "";
  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    const fence = /^```/.test(line);
    if (fence) {
      inCode = !inCode;
      out.push(line);
      blankRun = 0;
      continue;
    }
    if (inCode) { out.push(raw); continue; }
    if (line.trim() === "") {
      blankRun++;
      if (blankRun <= 1) out.push("");
      continue;
    }
    blankRun = 0;
    if (line === lastNonCode) continue;
    lastNonCode = line;
    out.push(line);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n") + "\n";
}
