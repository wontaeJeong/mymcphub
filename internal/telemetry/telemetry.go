package telemetry

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

type contextKey string

const correlationKey contextKey = "mcp-hub-correlation"

type Correlation struct {
	TraceID     string
	SpanID      string
	RequestID   string
	TraceParent string
	Sampled     bool
}

func Init(ctx context.Context, service string) (func(context.Context) error, error) {
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
	if getenv("OTEL_SDK_DISABLED", "false") == "true" {
		return func(context.Context) error { return nil }, nil
	}
	options := []sdktrace.TracerProviderOption{
		sdktrace.WithResource(resource.NewWithAttributes("", attribute.String("service.name", service))),
		sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(sampleRatioFloat()))),
	}
	if os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT") != "" {
		exporter, err := otlptracehttp.New(ctx)
		if err != nil {
			return nil, err
		}
		options = append(options, sdktrace.WithBatcher(exporter))
	}
	provider := sdktrace.NewTracerProvider(options...)
	otel.SetTracerProvider(provider)
	return provider.Shutdown, nil
}

func Span(name string, fn func()) {
	_, span := otel.Tracer("github.com/mcp-hub/mcp-hub/internal/telemetry").Start(context.Background(), name)
	defer span.End()
	fn()
}

func ContextWithNewCorrelation(ctx context.Context) context.Context {
	traceID := randomHex(16)
	correlation := Correlation{TraceID: traceID, SpanID: randomHex(8), RequestID: traceID, Sampled: true}
	correlation.TraceParent = traceParentFor(correlation.TraceID, correlation.SpanID, correlation.Sampled)
	return ContextWithCorrelation(ctx, correlation)
}

func ContextWithCorrelation(ctx context.Context, correlation Correlation) context.Context {
	if correlation.TraceID == "" {
		correlation.TraceID = randomHex(16)
	}
	if correlation.SpanID == "" {
		correlation.SpanID = randomHex(8)
	}
	if correlation.RequestID == "" {
		correlation.RequestID = correlation.TraceID
	}
	if correlation.TraceParent == "" {
		correlation.TraceParent = traceParentFor(correlation.TraceID, correlation.SpanID, correlation.Sampled)
	}
	return context.WithValue(ctx, correlationKey, correlation)
}

func CorrelationFromContext(ctx context.Context) Correlation {
	if ctx == nil {
		return Correlation{}
	}
	if correlation, ok := ctx.Value(correlationKey).(Correlation); ok {
		return correlation
	}
	return Correlation{}
}

func TraceID(ctx context.Context) string { return CorrelationFromContext(ctx).TraceID }
func SpanID(ctx context.Context) string  { return CorrelationFromContext(ctx).SpanID }
func RequestID(ctx context.Context) string {
	return CorrelationFromContext(ctx).RequestID
}
func TraceParent(ctx context.Context) string {
	return CorrelationFromContext(ctx).TraceParent
}

func FromRequest(r *http.Request) Correlation {
	traceParentTraceID, _, sampled := parseTraceParent(r.Header.Get("traceparent"))
	traceID := strings.TrimSpace(r.Header.Get("x-trace-id"))
	requestID := strings.TrimSpace(r.Header.Get("x-request-id"))
	if traceID == "" {
		traceID = traceParentTraceID
	}
	if traceID == "" {
		traceID = requestID
	}
	if traceID == "" {
		traceID = randomHex(16)
	}
	if requestID == "" {
		requestID = traceID
	}
	correlation := Correlation{TraceID: traceID, SpanID: randomHex(8), RequestID: requestID, Sampled: sampled}
	correlation.TraceParent = traceParentFor(firstNonEmpty(traceParentTraceID, traceID), correlation.SpanID, sampled)
	return correlation
}

func Handler(service string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		correlation := FromRequest(r)
		ctx := otel.GetTextMapPropagator().Extract(r.Context(), propagation.HeaderCarrier(r.Header))
		route := NormalizeRoute(r.URL.Path)
		method := NormalizeMethod(r.Method)
		ctx, span := otel.Tracer("github.com/mcp-hub/mcp-hub/"+service).Start(ctx, method+" "+route)
		defer span.End()
		if span.SpanContext().IsValid() {
			correlation.SpanID = span.SpanContext().SpanID().String()
			if strings.TrimSpace(r.Header.Get("x-trace-id")) == "" {
				correlation.TraceID = span.SpanContext().TraceID().String()
			}
			correlation.TraceParent = traceParentFor(span.SpanContext().TraceID().String(), span.SpanContext().SpanID().String(), span.SpanContext().IsSampled())
		}
		ctx = ContextWithCorrelation(ctx, correlation)
		span.SetAttributes(attribute.String("http.request.method", method), attribute.String("http.route", route))
		w.Header().Set("x-trace-id", correlation.TraceID)
		w.Header().Set("x-request-id", correlation.RequestID)
		w.Header().Set("traceparent", correlation.TraceParent)
		otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(w.Header()))

		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		started := time.Now()
		next.ServeHTTP(recorder, r.WithContext(ctx))
		span.SetAttributes(attribute.Int("http.response.status_code", recorder.status))
		if recorder.status >= 500 {
			span.SetStatus(codes.Error, http.StatusText(recorder.status))
		}
		RecordHTTP(service, method, route, recorder.status, time.Since(started))
	})
}

func InjectHeaders(ctx context.Context, header http.Header) {
	otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(header))
	correlation := CorrelationFromContext(ctx)
	if correlation.TraceID != "" {
		header.Set("x-trace-id", correlation.TraceID)
	}
	if correlation.RequestID != "" {
		header.Set("x-request-id", correlation.RequestID)
	}
	if correlation.TraceParent != "" {
		header.Set("traceparent", correlation.TraceParent)
	}
}

func NormalizeMethod(method string) string {
	switch method {
	case http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodHead, http.MethodOptions:
		return method
	default:
		return "OTHER"
	}
}

func NormalizeRoute(path string) string {
	switch {
	case path == "":
		return "/"
	case knownStaticRoute(path):
		return path
	case strings.HasPrefix(path, "/mcp/"):
		return "/mcp/{serverSlug}"
	case path == "/api/servers" || path == "/api/grants" || path == "/api/approvals":
		return path
	case strings.HasPrefix(path, "/api/servers/"):
		return normalizeServerRoute(path)
	case strings.HasPrefix(path, "/api/grants/"):
		return normalizeGrantRoute(path)
	case strings.HasPrefix(path, "/api/approvals/"):
		return normalizeApprovalRoute(path)
	case strings.HasPrefix(path, "/api/admin/revoke-server-grants/"):
		return "/api/admin/revoke-server-grants/{serverId}"
	default:
		return "/{unmatched}"
	}
}

func knownStaticRoute(path string) bool {
	switch path {
	case "/", "/healthz", "/readyz", "/metrics", "/jobs/run", "/openapi.json", "/api/openapi.json", "/api/me", "/api/audit-events", "/api/audit-events/export", "/api/audit-events/gateway", "/api/tool-call-events", "/api/server-health", "/api/analytics/usage", "/api/analytics/usage/export", "/api/analytics/denied-calls", "/api/client-config/generate", "/api/policy/validate", "/api/policy/simulate", "/api/policy/test-call", "/api/admin/emergency-deny", "/api/admin/emergency-deny/disable":
		return true
	default:
		return false
	}
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

type httpKey struct{ method, route, status string }
type mcpKey struct{ method, decision, status string }
type reasonKey struct{ reason string }
type jobKey struct{ kind, status string }

type histogram struct {
	count   int
	sum     float64
	buckets []int
}

type recorder struct {
	mu              sync.Mutex
	httpRequests    map[httpKey]int
	httpDurations   map[httpKey]*histogram
	mcpCalls        map[mcpKey]int
	mcpDurations    map[mcpKey]*histogram
	policyDenies    map[reasonKey]int
	upstreamErrors  map[reasonKey]int
	jobs            map[jobKey]int
	jobDurations    map[jobKey]*histogram
	workerLastJobs  int
	workerLastRunAt time.Time
}

var (
	metricsMu sync.Mutex
	metrics   = map[string]*recorder{}
	buckets   = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}
)

func RecordHTTP(service, method, route string, status int, duration time.Duration) {
	if service == "" {
		return
	}
	statusText := strconv.Itoa(status)
	recorder := recorderFor(service)
	recorder.mu.Lock()
	defer recorder.mu.Unlock()
	key := httpKey{method: method, route: route, status: statusText}
	recorder.httpRequests[key]++
	observe(recorder.httpDurations, key, duration.Seconds())
}

func RecordMCPCall(service, method, decision, status string, duration time.Duration) {
	recorder := recorderFor(service)
	recorder.mu.Lock()
	defer recorder.mu.Unlock()
	key := mcpKey{method: method, decision: decision, status: status}
	recorder.mcpCalls[key]++
	observe(recorder.mcpDurations, key, duration.Seconds())
}

func RecordPolicyDeny(service, reason string) {
	recorder := recorderFor(service)
	recorder.mu.Lock()
	defer recorder.mu.Unlock()
	recorder.policyDenies[reasonKey{reason: safeReason(reason)}]++
}

func RecordUpstreamError(service, reason string) {
	recorder := recorderFor(service)
	recorder.mu.Lock()
	defer recorder.mu.Unlock()
	recorder.upstreamErrors[reasonKey{reason: safeReason(reason)}]++
}

func RecordJob(service, kind, status string, duration time.Duration) {
	recorder := recorderFor(service)
	recorder.mu.Lock()
	defer recorder.mu.Unlock()
	key := jobKey{kind: kind, status: status}
	recorder.jobs[key]++
	observe(recorder.jobDurations, key, duration.Seconds())
}

func SetWorkerLastRun(service string, jobs int) {
	recorder := recorderFor(service)
	recorder.mu.Lock()
	defer recorder.mu.Unlock()
	recorder.workerLastJobs = jobs
	recorder.workerLastRunAt = time.Now()
}

func MetricsText(service string) string {
	recorder := recorderFor(service)
	recorder.mu.Lock()
	defer recorder.mu.Unlock()

	var b strings.Builder
	fmt.Fprintf(&b, "mcp_%s_request_info{service=%q} 1\n", sanitizeMetricPart(service), service)
	fmt.Fprintf(&b, "mcp_telemetry_exporter_info{service=%q,enabled=%q,exporter=%q,endpoint_configured=%q,sample_ratio=%q} 1\n", service, boolLabel(getenv("OTEL_SDK_DISABLED", "false") != "true"), exporterName(), boolLabel(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT") != ""), sampleRatio())

	emitHTTPMetrics(&b, service, recorder)
	emitMCPMetrics(&b, recorder)
	emitJobMetrics(&b, recorder)
	return b.String()
}

func recorderFor(service string) *recorder {
	metricsMu.Lock()
	defer metricsMu.Unlock()
	if current, ok := metrics[service]; ok {
		return current
	}
	current := &recorder{
		httpRequests:   map[httpKey]int{},
		httpDurations:  map[httpKey]*histogram{},
		mcpCalls:       map[mcpKey]int{},
		mcpDurations:   map[mcpKey]*histogram{},
		policyDenies:   map[reasonKey]int{},
		upstreamErrors: map[reasonKey]int{},
		jobs:           map[jobKey]int{},
		jobDurations:   map[jobKey]*histogram{},
	}
	metrics[service] = current
	return current
}

func observe[K comparable](values map[K]*histogram, key K, seconds float64) {
	current := values[key]
	if current == nil {
		current = &histogram{buckets: make([]int, len(buckets))}
		values[key] = current
	}
	current.count++
	current.sum += seconds
	for i, bucket := range buckets {
		if seconds <= bucket {
			current.buckets[i]++
		}
	}
}

func emitHTTPMetrics(b *strings.Builder, service string, recorder *recorder) {
	metricPrefix := "mcp_" + sanitizeMetricPart(service) + "_http"
	keys := make([]httpKey, 0, len(recorder.httpRequests))
	for key := range recorder.httpRequests {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool { return fmt.Sprint(keys[i]) < fmt.Sprint(keys[j]) })
	for _, key := range keys {
		fmt.Fprintf(b, "%s_requests_total{method=%q,route=%q,status=%q} %d\n", metricPrefix, key.method, key.route, key.status, recorder.httpRequests[key])
		emitHistogram(b, metricPrefix+"_request_duration_seconds", map[string]string{"method": key.method, "route": key.route, "status": key.status}, recorder.httpDurations[key])
	}
}

func emitMCPMetrics(b *strings.Builder, recorder *recorder) {
	keys := make([]mcpKey, 0, len(recorder.mcpCalls))
	for key := range recorder.mcpCalls {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool { return fmt.Sprint(keys[i]) < fmt.Sprint(keys[j]) })
	for _, key := range keys {
		fmt.Fprintf(b, "mcp_gateway_tool_calls_total{method=%q,decision=%q,status=%q} %d\n", key.method, key.decision, key.status, recorder.mcpCalls[key])
		emitHistogram(b, "mcp_gateway_tool_call_duration_seconds", map[string]string{"method": key.method, "decision": key.decision, "status": key.status}, recorder.mcpDurations[key])
	}
	reasons := make([]reasonKey, 0, len(recorder.policyDenies))
	for key := range recorder.policyDenies {
		reasons = append(reasons, key)
	}
	sort.Slice(reasons, func(i, j int) bool { return reasons[i].reason < reasons[j].reason })
	for _, key := range reasons {
		fmt.Fprintf(b, "mcp_gateway_policy_denies_total{reason=%q} %d\n", key.reason, recorder.policyDenies[key])
	}
	reasons = reasons[:0]
	for key := range recorder.upstreamErrors {
		reasons = append(reasons, key)
	}
	sort.Slice(reasons, func(i, j int) bool { return reasons[i].reason < reasons[j].reason })
	for _, key := range reasons {
		fmt.Fprintf(b, "mcp_gateway_upstream_errors_total{reason=%q} %d\n", key.reason, recorder.upstreamErrors[key])
	}
}

func emitJobMetrics(b *strings.Builder, recorder *recorder) {
	fmt.Fprintf(b, "mcp_worker_last_run_jobs_total %d\n", recorder.workerLastJobs)
	if !recorder.workerLastRunAt.IsZero() {
		fmt.Fprintf(b, "mcp_worker_last_run_timestamp_seconds %d\n", recorder.workerLastRunAt.Unix())
	}
	keys := make([]jobKey, 0, len(recorder.jobs))
	for key := range recorder.jobs {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool { return fmt.Sprint(keys[i]) < fmt.Sprint(keys[j]) })
	for _, key := range keys {
		fmt.Fprintf(b, "mcp_worker_jobs_total{kind=%q,status=%q} %d\n", key.kind, key.status, recorder.jobs[key])
		emitHistogram(b, "mcp_worker_job_duration_seconds", map[string]string{"kind": key.kind, "status": key.status}, recorder.jobDurations[key])
	}
}

func emitHistogram(b *strings.Builder, name string, labels map[string]string, value *histogram) {
	if value == nil {
		return
	}
	for i, bucket := range buckets {
		labels["le"] = strconv.FormatFloat(bucket, 'f', -1, 64)
		fmt.Fprintf(b, "%s_bucket%s %d\n", name, formatLabels(labels), value.buckets[i])
	}
	labels["le"] = "+Inf"
	fmt.Fprintf(b, "%s_bucket%s %d\n", name, formatLabels(labels), value.count)
	delete(labels, "le")
	fmt.Fprintf(b, "%s_sum%s %s\n", name, formatLabels(labels), strconv.FormatFloat(value.sum, 'f', -1, 64))
	fmt.Fprintf(b, "%s_count%s %d\n", name, formatLabels(labels), value.count)
}

func formatLabels(labels map[string]string) string {
	keys := make([]string, 0, len(labels))
	for key := range labels {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s=%q", key, labels[key]))
	}
	return "{" + strings.Join(parts, ",") + "}"
}

func normalizeServerRoute(path string) string {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(path, "/api/servers"), "/"), "/")
	if len(parts) == 1 && parts[0] != "" {
		return "/api/servers/{serverId}"
	}
	if len(parts) == 2 {
		switch parts[1] {
		case "publish", "unpublish", "disable", "enable", "quarantine", "schema-diff", "versions", "tools":
			return "/api/servers/{serverId}/" + parts[1]
		}
	}
	if len(parts) == 3 && parts[1] == "tools" {
		return "/api/servers/{serverId}/tools/{toolId}"
	}
	if len(parts) == 4 && parts[1] == "tools" {
		switch parts[3] {
		case "enable", "disable", "schema":
			return "/api/servers/{serverId}/tools/{toolId}/" + parts[3]
		}
	}
	if len(parts) == 4 && parts[1] == "versions" {
		switch parts[3] {
		case "activate", "rollback":
			return "/api/servers/{serverId}/versions/{versionId}/" + parts[3]
		}
	}
	return "/{unmatched}"
}

func normalizeGrantRoute(path string) string {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(path, "/api/grants"), "/"), "/")
	if len(parts) == 1 && parts[0] != "" {
		return "/api/grants/{grantId}"
	}
	if len(parts) == 2 {
		switch parts[1] {
		case "approve", "revoke":
			return "/api/grants/{grantId}/" + parts[1]
		}
	}
	return "/{unmatched}"
}

func normalizeApprovalRoute(path string) string {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(path, "/api/approvals"), "/"), "/")
	if len(parts) == 2 {
		switch parts[1] {
		case "approve", "reject":
			return "/api/approvals/{approvalId}/" + parts[1]
		}
	}
	return "/{unmatched}"
}

func parseTraceParent(value string) (string, string, bool) {
	parts := strings.Split(strings.TrimSpace(value), "-")
	if len(parts) != 4 || len(parts[1]) != 32 || len(parts[2]) != 16 {
		return "", "", true
	}
	if !isHex(parts[1]) || !isHex(parts[2]) {
		return "", "", true
	}
	flags, err := strconv.ParseUint(parts[3], 16, 8)
	return parts[1], parts[2], err != nil || flags&1 == 1
}

func traceParentFor(traceID, spanID string, sampled bool) string {
	w3cTraceID := toW3CTraceID(traceID)
	if len(spanID) != 16 || !isHex(spanID) {
		spanID = randomHex(8)
	}
	flags := "00"
	if sampled {
		flags = "01"
	}
	return "00-" + w3cTraceID + "-" + spanID + "-" + flags
}

func toW3CTraceID(traceID string) string {
	trimmed := strings.ToLower(strings.TrimSpace(traceID))
	if len(trimmed) == 32 && isHex(trimmed) {
		return trimmed
	}
	sum := sha256.Sum256([]byte(trimmed))
	return hex.EncodeToString(sum[:16])
}

func randomHex(bytes int) string {
	buf := make([]byte, bytes)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%0*x", bytes*2, time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}

func isHex(value string) bool {
	for _, ch := range value {
		if (ch < '0' || ch > '9') && (ch < 'a' || ch > 'f') && (ch < 'A' || ch > 'F') {
			return false
		}
	}
	return value != strings.Repeat("0", len(value))
}

func safeReason(reason string) string {
	if strings.TrimSpace(reason) == "" {
		return "unknown"
	}
	return strings.ToUpper(strings.TrimSpace(reason))
}

func boolLabel(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func sanitizeMetricPart(value string) string {
	return strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			return r
		}
		return '_'
	}, value)
}

func exporterName() string {
	if os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT") != "" {
		return "otlp"
	}
	return "none"
}

func sampleRatio() string {
	return strconv.FormatFloat(sampleRatioFloat(), 'f', -1, 64)
}

func sampleRatioFloat() float64 {
	value := getenv("OTEL_TRACES_SAMPLER_ARG", "1")
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 1
	}
	return math.Max(0, math.Min(1, parsed))
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
