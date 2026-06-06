# Helm

Helm chart assets for MCP Hub will be added in the deployment phase.

Prompt-07 includes scoped stdio adapter examples only:

- `stdio-adapter-values.example.yaml` shows values for one adapter instance wrapping `stdio-sample`.
- `templates/stdio-adapter.example.yaml` shows Deployment, Service, and NetworkPolicy resources with resource limits and read-only root filesystem settings.

These files are examples for the later full Helm/GitOps phase and are not a complete chart.
