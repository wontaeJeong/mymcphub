# Rollback

Rollback means returning to the previous known-good Go image tag or digest. It does not mean switching back to a legacy service stack.

```sh
helm rollback mcp-hub <revision> --namespace mcp-hub
```

For GitOps, revert the image digest changes in the target overlay and let the controller sync.

After rollback, verify:

```sh
mcphubctl health
curl http://<gateway>/mcp/k8s-readonly -H 'authorization: Bearer dev-admin-token'
```
