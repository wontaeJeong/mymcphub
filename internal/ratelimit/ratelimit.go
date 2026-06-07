package ratelimit

import (
	"strings"
	"sync"
	"time"
)

type Limiter struct {
	mu      sync.Mutex
	buckets map[string]bucket
	limit   int
	window  time.Duration
	backend Backend
}

type Backend interface {
	IncrementRateLimitBucket(key string, window time.Duration) (int, time.Time, error)
}

type bucket struct {
	count   int
	resetAt time.Time
}

type Decision struct {
	Allowed    bool
	Key        string
	Limit      int
	Remaining  int
	ResetAt    time.Time
	RetryAfter time.Duration
	Error      error
}

func New(limit int) *Limiter {
	return NewWindow(limit, time.Minute)
}

func NewWindow(limit int, window time.Duration) *Limiter {
	if limit <= 0 {
		limit = 1000
	}
	if window <= 0 {
		window = time.Minute
	}
	return &Limiter{buckets: map[string]bucket{}, limit: limit, window: window}
}

func NewStore(limit int, window time.Duration, backend Backend) *Limiter {
	limiter := NewWindow(limit, window)
	limiter.backend = backend
	return limiter
}

func (l *Limiter) Allow(key string) bool {
	return l.Check([]string{key}).Allowed
}

func (l *Limiter) Check(parts []string) Decision {
	key := normalizeKey(parts)
	if l.backend != nil {
		count, resetAt, err := l.backend.IncrementRateLimitBucket(key, l.window)
		if err != nil {
			return Decision{Allowed: false, Key: key, Limit: l.limit, ResetAt: time.Now().UTC().Add(l.window), Error: err}
		}
		return decisionFromCount(key, l.limit, count, resetAt)
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now().UTC()
	current := l.buckets[key]
	if current.resetAt.IsZero() || !now.Before(current.resetAt) {
		current = bucket{resetAt: now.Add(l.window)}
	}
	current.count++
	l.buckets[key] = current
	return decisionFromCount(key, l.limit, current.count, current.resetAt)
}

func decisionFromCount(key string, limit int, count int, resetAt time.Time) Decision {
	remaining := limit - count
	if remaining < 0 {
		remaining = 0
	}
	decision := Decision{Allowed: count <= limit, Key: key, Limit: limit, Remaining: remaining, ResetAt: resetAt}
	if !decision.Allowed {
		decision.RetryAfter = time.Until(resetAt)
		if decision.RetryAfter < time.Second {
			decision.RetryAfter = time.Second
		}
	}
	return decision
}

func normalizeKey(parts []string) string {
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	if len(out) == 0 {
		return "anonymous"
	}
	return strings.Join(out, "|")
}
