# 55 Metrics Dashboards Handoff

## Changed Files

- `internal/telemetry/telemetry.go`
- `internal/controlplane/server.go`
- `internal/gateway/server.go`
- `internal/worker/server.go`
- `deploy/helm/mcp-hub/templates/service-worker.yaml`
- `deploy/helm/mcp-hub/templates/servicemonitor.yaml`
- `deploy/helm/mcp-hub/templates/grafana-dashboard-configmap.yaml`
- `deploy/helm/mcp-hub/values*.yaml`
- `deploy/gitops/overlays/*/kustomization.yaml`
- `tests/helm-template.sh`

## Contract/Schema Changes

- Prometheus text now includes HTTP counters/duration histograms, Gateway tool-call metrics, Worker job metrics, and telemetry exporter info.

## DB Migration

- None.

## Verification

- `pnpm helm:template`, `make lint`, `make test`, `make build`, and manual metrics QA passed.

## Remaining TODO

- None for chart/rendering. Dashboard import depends on a Grafana sidecar honoring `grafana_dashboard=1`.

## Conflict Notes

- Lane G CI should retain Helm assertions for ServiceMonitor/Grafana/PrometheusRule rendering.
