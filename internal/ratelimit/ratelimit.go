package ratelimit

import "sync"

type Limiter struct {
	mu     sync.Mutex
	counts map[string]int
	limit  int
}

func New(limit int) *Limiter {
	if limit <= 0 {
		limit = 1000
	}
	return &Limiter{counts: map[string]int{}, limit: limit}
}
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.counts[key]++
	return l.counts[key] <= l.limit
}
