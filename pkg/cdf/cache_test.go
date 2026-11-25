package cdf

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestCachedJSONPreservesLargeID(t *testing.T) {
	const id = json.Number("9007199254740993")
	cache := NewCache(1, nil)
	started, release := make(chan struct{}), make(chan struct{})
	var calls atomic.Int32
	load := func(context.Context) (map[string]any, error) {
		if calls.Add(1) == 1 {
			close(started)
		}
		<-release
		return map[string]any{"id": id}, nil
	}
	read := func(ctx context.Context) {
		value, err := GetOrLoadJSON(ctx, cache, "key", time.Hour, load)
		if err != nil || value["id"] != id {
			t.Errorf("unexpected cached value %v, error %v", value, err)
		}
	}
	var wg sync.WaitGroup
	wg.Go(func() { read(t.Context()) })
	<-started
	waiter := &observedContext{Context: t.Context(), observed: make(chan struct{})}
	wg.Go(func() { read(waiter) })
	<-waiter.observed
	close(release)
	wg.Wait()
	read(t.Context())
	if calls.Load() != 1 {
		t.Fatalf("loader called %d times", calls.Load())
	}
}

func TestCacheKeyTupleBoundaries(t *testing.T) {
	if CacheKey("user", "views", "a:b", "c") == CacheKey("user", "views", "a", "b:c") {
		t.Fatal("distinct resource identities share a key")
	}
}

func TestCacheTTLEvictionIdentityAndConcurrency(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	var mu sync.Mutex
	clock := func() time.Time {
		mu.Lock()
		defer mu.Unlock()
		return now
	}
	advance := func(d time.Duration) {
		mu.Lock()
		defer mu.Unlock()
		now = now.Add(d)
	}

	kAlice := CacheKey("Bearer secret-alice", "units")
	kBob := CacheKey("Bearer secret-bob", "units")
	if kAlice == kBob {
		t.Fatal("cache keys must isolate distinct identities")
	}
	if strings.Contains(kAlice, "secret-alice") || strings.Contains(kBob, "secret-bob") {
		t.Fatal("cache keys must never contain raw tokens")
	}

	c := NewCache(2, clock)
	c.Set(kAlice, []byte(`"a"`), time.Minute)
	c.Set(kBob, []byte(`"b"`), time.Minute)
	c.Set(CacheKey("Bearer charlie", "units"), []byte(`"c"`), time.Minute)
	if c.Len() != 2 {
		t.Fatalf("expected bounded size 2, got %d", c.Len())
	}
	if _, ok := c.Get(kAlice); ok {
		t.Fatal("expected oldest entry to be evicted")
	}

	advance(2 * time.Minute)
	if _, ok := c.Get(kBob); ok {
		t.Fatal("expected expired entry to miss")
	}

	var loads atomic.Int32
	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			got, err := GetOrLoadJSON[map[string]int](context.Background(), c, kAlice, time.Minute, func(ctx context.Context) (map[string]int, error) {
				loads.Add(1)
				time.Sleep(15 * time.Millisecond)
				return map[string]int{"x": 42}, nil
			})
			if err != nil || got["x"] != 42 {
				t.Errorf("unexpected load result: %v err=%v", got, err)
			}
			got["x"] = 999 // must not mutate cached copy
		}()
	}
	wg.Wait()
	if loads.Load() != 1 {
		t.Fatalf("expected 1 singleflight load, got %d", loads.Load())
	}
	again, err := GetOrLoadJSON[map[string]int](context.Background(), c, kAlice, time.Minute, func(ctx context.Context) (map[string]int, error) {
		loads.Add(1)
		return map[string]int{"x": 0}, nil
	})
	if err != nil || again["x"] != 42 {
		t.Fatalf("expected isolated cached copy 42, got %v err=%v", again, err)
	}
}
func TestCacheByteBudget(t *testing.T) {
	c := NewCache(10, nil)
	c.maxBytes = 8
	c.maxEntryBytes = 6
	c.Set("a", []byte("12345"), time.Minute)
	c.Set("b", []byte("12345"), time.Minute)
	if _, ok := c.Get("a"); ok {
		t.Fatal("byte budget did not evict LRU")
	}
	c.Set("b", []byte("1"), time.Minute)
	if c.bytes != 1 {
		t.Fatalf("update byte count: %d", c.bytes)
	}
	c.Set("b", []byte("oversize"), time.Minute)
	if c.bytes != 0 || c.Len() != 0 {
		t.Fatal("oversize update retained stale value")
	}
}
func TestCacheCanceledOwnerCanBeRetried(t *testing.T) {
	c := NewCache(10, nil)
	ctx, cancel := context.WithCancel(context.Background())
	started := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		_, err := GetOrLoadJSON(ctx, c, "key", time.Minute, func(ctx context.Context) (int, error) { close(started); <-ctx.Done(); return 0, ctx.Err() })
		done <- err
	}()
	<-started
	waiterCtx := &observedContext{Context: context.Background(), observed: make(chan struct{})}
	waiter := make(chan error, 1)
	go func() {
		got, err := GetOrLoadJSON(waiterCtx, c, "key", time.Minute, func(context.Context) (int, error) { return 42, nil })
		if got != 42 && err == nil {
			err = errors.New("incorrect waiter result")
		}
		waiter <- err
	}()
	<-waiterCtx.observed
	cancel()
	if !errors.Is(<-done, context.Canceled) {
		t.Fatal("owner cancellation lost")
	}
	if err := <-waiter; err != nil {
		t.Fatalf("active waiter failed: %v", err)
	}

}

type observedContext struct {
	context.Context
	once     sync.Once
	observed chan struct{}
}

func (c *observedContext) Done() <-chan struct{} {
	c.once.Do(func() { close(c.observed) })
	return c.Context.Done()
}

func BenchmarkCacheMetadata(b *testing.B) {
	c := NewCache(512, nil)
	payload := []byte(strings.Repeat("x", 1<<20))
	c.Set("metadata", payload, time.Minute)
	b.ReportAllocs()
	b.SetBytes(int64(len(payload)))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, ok := c.Get("metadata"); !ok {
			b.Fatal("cache miss")
		}
	}
}
