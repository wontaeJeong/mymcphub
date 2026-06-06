/* global process */

import { createInterface } from "node:readline";

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.method === "ping") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id ?? null, result: {} }) + "\n");
    return;
  }

  process.exit(9);
});
