package load

import (
	"context"
	"net/http"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/auth"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/mcp"
	"github.com/mcp-hub/mcp-hub/internal/testutil"
)

func TestGatewayLoadHandlesConcurrencyLatencyAndMemory(t *testing.T) {
	store := db.NewSeedStore()
	testutil.NewGrantedLocalServer(t, store, "lane-g-load", []string{"fixture_echo"}, "")
	handler := testutil.NewGatewayHandler(store, nil)

	runtime.GC()
	var before runtime.MemStats
	runtime.ReadMemStats(&before)
	started := time.Now()

	const concurrency = 16
	const perWorker = 8
	errs := make(chan string, concurrency*perWorker)
	var wg sync.WaitGroup
	for worker := 0; worker < concurrency; worker++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < perWorker; i++ {
				response := testutil.PostMCP(t, handler, "/mcp/lane-g-load", auth.AdminToken, map[string]interface{}{"jsonrpc": "2.0", "id": i, "method": "tools/call", "params": map[string]interface{}{"name": "fixture_echo", "arguments": map[string]interface{}{"iteration": i}}})
				if response.Code != http.StatusOK {
					errs <- response.Body.String()
				}
			}
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatalf("load request failed: %s", err)
	}

	elapsed := time.Since(started)
	if elapsed > 2*time.Second {
		t.Fatalf("load test exceeded latency budget: %s", elapsed)
	}
	runtime.GC()
	var after runtime.MemStats
	runtime.ReadMemStats(&after)
	if after.Alloc > before.Alloc+(32<<20) {
		t.Fatalf("unexpected memory growth before=%d after=%d", before.Alloc, after.Alloc)
	}
}

func TestGatewayLoadHonorsCancellation(t *testing.T) {
	store := db.NewSeedStore()
	testutil.NewGrantedLocalServer(t, store, "lane-g-cancel", []string{"fixture_echo"}, "")
	handler := testutil.NewGatewayHandler(store, cancelAwareUpstream{})

	body := map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": map[string]interface{}{"name": "fixture_echo", "arguments": map[string]interface{}{}}}
	recorder := testutil.PostMCPWithCanceledContext(t, handler, "/mcp/lane-g-cancel", auth.AdminToken, body)
	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("expected canceled upstream to map to 502, got %d body %s", recorder.Code, recorder.Body.String())
	}
}

type cancelAwareUpstream struct{}

func (cancelAwareUpstream) Call(ctx context.Context, _ db.MCPServer, request mcp.Request, _ string) (mcp.Response, int, error) {
	select {
	case <-ctx.Done():
		return mcp.Response{}, 0, ctx.Err()
	case <-time.After(10 * time.Millisecond):
		return mcp.Result(request.ID, map[string]interface{}{"ok": true}), http.StatusOK, nil
	}
}
