# Lane E - Observability/Audit/Analytics

OTel, metrics, audit pipeline, usage/accounting, alert/runbook을 구현한다.

## 병렬 작업 위치

권장 worktree:

```bash
git worktree add ../mcp-hub-e_observability_audit_analytics -b lane/e_observability_audit_analytics
cd ../mcp-hub-e_observability_audit_analytics
```

## 주요 소유 경로

- `packages/observability/**`
- `dashboards/**`
- `apps/worker/**`
- `docs/operations/**`

## 가급적 건드리지 말 경로

- `apps/web/**`
- `packages/db/**`

## 이 lane의 프롬프트

- `54_OTEL_INSTRUMENTATION.md` - OpenTelemetry Instrumentation
- `55_METRICS_DASHBOARDS.md` - Metrics and Grafana Dashboards
- `56_STRUCTURED_AUDIT_PIPELINE.md` - Structured Audit Event Pipeline
- `57_TRACE_CORRELATION.md` - Trace Correlation
- `58_USAGE_ACCOUNTING_REPORTS.md` - Usage and Accounting Reports
- `59_DENIED_CALL_ANALYTICS.md` - Denied Call Analytics
- `60_HEALTH_CHECK_SCHEDULER.md` - Health Check Scheduler
- `61_ALERT_RULES_RUNBOOKS.md` - Alert Rules and Runbooks

## 병렬 merge 주의사항

- shared DB schema 변경은 Lane B가 최종 소유한다.
- UI가 필요한 API가 아직 없으면 mock client 또는 MSW/fake API를 만든다.
- Gateway가 필요한 policy source가 아직 없으면 in-memory adapter를 만든다.
- Runtime/Worker가 필요한 catalog source가 아직 없으면 fixture manifest를 만든다.
- 완료 후 `docs/handoffs/e_observability_audit_analytics.md`를 작성한다.
