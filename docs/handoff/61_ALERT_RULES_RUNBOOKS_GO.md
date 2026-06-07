# 61 Alert Rules Runbooks Handoff

## Changed Files

- `deploy/helm/mcp-hub/templates/prometheusrule.yaml`
- `deploy/helm/mcp-hub/templates/grafana-dashboard-configmap.yaml`
- `deploy/helm/mcp-hub/templates/servicemonitor.yaml`
- `deploy/helm/mcp-hub/values*.yaml`
- `deploy/gitops/overlays/*/kustomization.yaml`
- `docs/RUNBOOK.md`
- `docs/RUNBOOKS.md`
- `docs/AUDIT_OBSERVABILITY.md`
- `tests/helm-template.sh`

## Contract/Schema Changes

- No API schema change specific to alerts. Helm values now include `prometheusRule` and `grafanaDashboards` settings.
- Gateway error-rate alerting includes a request-rate floor to avoid low-volume false positives.

## DB Migration

- None.

## Verification

- `pnpm helm:template`, schema checks, build, lint, and manual metrics QA passed.

## Remaining TODO

- None.

## Conflict Notes

- Alert rules assume Prometheus Operator CRDs and a Grafana sidecar in target clusters.
