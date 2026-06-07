# Scripts to CLI Migration

Scripts are limited to dev, ci, gen, and release support. Operational actions move to `mcphubctl`, the Web UI, or the Control Plane API.

| Former script category | New interface |
| --- | --- |
| server publish/disable/quarantine | `mcphubctl server publish|disable|quarantine <server>` |
| grant approve/revoke | `mcphubctl grant approve|revoke <grant-id>` |
| policy validation/simulation | `mcphubctl policy validate|simulate -f policy.yaml` |
| audit search/export | `mcphubctl audit search`, `mcphubctl audit export` |
| client config generation | `mcphubctl client config --client opencode --profile local` |

No script should directly patch Kubernetes, mutate DB rows, or print raw secrets as an operator workflow.
