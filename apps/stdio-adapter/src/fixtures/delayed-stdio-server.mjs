/* global process, setTimeout */

import { createInterface } from "node:readline";

const delayMs = Number(process.env.FIXTURE_DELAY_MS ?? 80);
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.method === "ping") {
    write({ jsonrpc: "2.0", id: request.id ?? null, result: {} });
    return;
  }
  setTimeout(() => {
    write({ jsonrpc: "2.0", id: request.id ?? null, result: { delayed: true } });
  }, delayMs);
});

function write(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}
