package ratelimit

import (
	"testing"
	"time"
)

func TestLimiterUsesWindowAndDimensionKey(t *testing.T) {
	limiter := NewWindow(1, 20*time.Millisecond)
	first := limiter.Check([]string{"user:u1", "server:s1", "tool:t1"})
	if !first.Allowed || first.Remaining != 0 {
		t.Fatalf("expected first request allowed, got %#v", first)
	}
	second := limiter.Check([]string{"user:u1", "server:s1", "tool:t1"})
	if second.Allowed || second.RetryAfter <= 0 {
		t.Fatalf("expected second request to be limited, got %#v", second)
	}
	otherTool := limiter.Check([]string{"user:u1", "server:s1", "tool:t2"})
	if !otherTool.Allowed {
		t.Fatalf("expected separate dimension key to be allowed, got %#v", otherTool)
	}
	time.Sleep(25 * time.Millisecond)
	reset := limiter.Check([]string{"user:u1", "server:s1", "tool:t1"})
	if !reset.Allowed {
		t.Fatalf("expected limiter to reset after window, got %#v", reset)
	}
}
