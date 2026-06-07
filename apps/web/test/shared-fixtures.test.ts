import assert from "node:assert/strict";

import localSeed from "../../../tests/fixtures/local-seed.json";

assert.equal(localSeed.users.some((user) => user.mockToken === "dev-admin-token"), true);
assert.equal(localSeed.projects[0]?.id, "00000000-0000-4000-8000-000000000020");
assert.equal(localSeed.servers[0]?.slug, "k8s-readonly");
assert.deepEqual(localSeed.servers[0]?.tools.map((tool) => tool.name), [
  "list_namespaces",
  "list_pods",
  "get_pod"
]);
assert.deepEqual(localSeed.clientProfiles, ["generic", "opencode", "claude-code", "codex", "vscode"]);
