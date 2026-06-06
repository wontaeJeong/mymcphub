import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { openApiDocument } from "./openapi";

const outputPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../schemas/openapi/control-plane.openapi.json"
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(openApiDocument, null, 2)}\n`, "utf8");

console.log(outputPath);
