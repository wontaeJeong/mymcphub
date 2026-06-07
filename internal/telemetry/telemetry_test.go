package telemetry

import (
	"strings"
	"testing"
	"time"
)

func TestNormalizeRouteAndMethodBoundLabels(t *testing.T) {
	if got := NormalizeRoute("/api/servers/123/tools/456/schema"); got != "/api/servers/{serverId}/tools/{toolId}/schema" {
		t.Fatalf("unexpected normalized route: %s", got)
	}
	if got := NormalizeRoute("/api/servers/123/raw-secret"); got != "/{unmatched}" {
		t.Fatalf("expected unknown server route to use unmatched bucket, got %s", got)
	}
	if got := NormalizeRoute("/api/grants/abc/raw-secret"); got != "/{unmatched}" {
		t.Fatalf("expected unknown grant route to use unmatched bucket, got %s", got)
	}
	if got := NormalizeRoute("/api/approvals/abc/raw-secret"); got != "/{unmatched}" {
		t.Fatalf("expected unknown approval route to use unmatched bucket, got %s", got)
	}
	if got := NormalizeRoute("/this/path/contains/raw/secret"); got != "/{unmatched}" {
		t.Fatalf("expected unmatched route bucket, got %s", got)
	}
	if got := NormalizeMethod("CUSTOMVERB"); got != "OTHER" {
		t.Fatalf("expected OTHER method bucket, got %s", got)
	}
}

func TestMetricsTextUsesBoundedHTTPLabels(t *testing.T) {
	RecordHTTP("testsvc", NormalizeMethod("CUSTOMVERB"), NormalizeRoute("/raw/token/path"), 404, time.Millisecond)
	metrics := MetricsText("testsvc")
	if !strings.Contains(metrics, `method="OTHER"`) || !strings.Contains(metrics, `route="/{unmatched}"`) {
		t.Fatalf("expected bounded method and route labels, got %s", metrics)
	}
	if strings.Contains(metrics, "token") {
		t.Fatalf("raw path segment leaked into metrics: %s", metrics)
	}
}
