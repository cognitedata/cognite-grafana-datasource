package cdf

import (
	"bytes"
	"container/list"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"sync"
	"time"
)

const defaultCacheMaxEntries = 512
const defaultCacheMaxBytes = 32 << 20
const defaultCacheMaxEntryBytes = 2 << 20

// CacheKey hashes the identity and ordered resource key parts. Length prefixes
// distinguish tuples even when identifiers contain delimiters.
func CacheKey(authIdentity, resource string, parts ...string) string {
	h := sha256.New()
	writePart := func(s string) {
		var length [8]byte
		binary.BigEndian.PutUint64(length[:], uint64(len(s)))
		h.Write(length[:])
		h.Write([]byte(s))
	}
	writePart(authIdentity)
	writePart(resource)
	for _, part := range parts {
		writePart(part)
	}
	return hex.EncodeToString(h.Sum(nil))
}

type cacheEntry struct {
	key       string
	value     []byte
	expiresAt time.Time
}

// Cache is a thread-safe bounded TTL byte cache with LRU eviction.
type Cache struct {
	mu            sync.Mutex
	maxEntries    int
	maxBytes      int
	maxEntryBytes int
	bytes         int
	now           func() time.Time
	items         map[string]*list.Element
	order         *list.List

	inflightMu sync.Mutex
	inflight   map[string]*inflightCall
}

type inflightCall struct {
	done chan struct{}
	val  []byte
	err  error
}

// NewCache creates a bounded TTL cache. Non-positive maxEntries defaults to 512.
func NewCache(maxEntries int, now func() time.Time) *Cache {
	if maxEntries <= 0 {
		maxEntries = defaultCacheMaxEntries
	}
	if now == nil {
		now = time.Now
	}
	return &Cache{
		maxEntries:    maxEntries,
		maxBytes:      defaultCacheMaxBytes,
		maxEntryBytes: defaultCacheMaxEntryBytes,
		now:           now,
		items:         make(map[string]*list.Element, maxEntries),
		order:         list.New(),
		inflight:      make(map[string]*inflightCall),
	}
}

// Get retrieves a copy of cached bytes for key when present and unexpired.
func (c *Cache) Get(key string) ([]byte, bool) {
	if c == nil {
		return nil, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	elem, ok := c.items[key]
	if !ok {
		return nil, false
	}
	entry := elem.Value.(*cacheEntry)
	if !entry.expiresAt.IsZero() && !c.now().Before(entry.expiresAt) {
		c.removeElement(elem)
		return nil, false
	}
	c.order.MoveToFront(elem)
	out := make([]byte, len(entry.value))
	copy(out, entry.value)
	return out, true
}

// Set stores a copy of value under key for ttl. Zero or negative ttl is ignored.
func (c *Cache) Set(key string, value []byte, ttl time.Duration) {
	if c == nil || ttl <= 0 {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if elem, ok := c.items[key]; ok {
		c.removeElement(elem)
	}
	if len(value) > c.maxEntryBytes || len(value) > c.maxBytes {
		return
	}
	c.pruneExpiredLocked()
	for len(c.items) >= c.maxEntries || c.bytes+len(value) > c.maxBytes {
		back := c.order.Back()
		if back == nil {
			break
		}
		c.removeElement(back)
	}
	stored := append([]byte(nil), value...)
	expires := c.now().Add(ttl)
	c.bytes += len(stored)
	elem := c.order.PushFront(&cacheEntry{
		key:       key,
		value:     stored,
		expiresAt: expires,
	})
	c.items[key] = elem
}

// Len returns the number of entries currently held in the cache.
func (c *Cache) Len() int {
	if c == nil {
		return 0
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.items)
}

var errCacheOwnerCanceled = errors.New("cache load owner canceled")

// GetOrLoadJSON returns a cached JSON-decoded value or executes loader with per-key deduplication.
func GetOrLoadJSON[T any](ctx context.Context, c *Cache, key string, ttl time.Duration, loader func(context.Context) (T, error)) (T, error) {
	for {
		if err := ctx.Err(); err != nil {
			var zero T
			return zero, err
		}
		result, err := getOrLoadJSONOnce(ctx, c, key, ttl, loader)
		// A canceled owner must not cancel an active waiter. Retry with this caller's
		// bounded context; completed failures and successes keep normal semantics.
		if ctx.Err() == nil && errors.Is(err, errCacheOwnerCanceled) {
			continue
		}
		if err := ctx.Err(); err != nil {
			var zero T
			return zero, err
		}
		return result, err
	}
}

func decodeCachedJSON(raw []byte, dst any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(dst); err != nil {
		return err
	}
	if len(bytes.TrimSpace(raw[decoder.InputOffset():])) != 0 {
		return errors.New("unexpected trailing data in cached JSON")
	}
	return nil
}

func getOrLoadJSONOnce[T any](
	ctx context.Context,
	c *Cache,
	key string,
	ttl time.Duration,
	loader func(context.Context) (T, error),
) (T, error) {
	var zero T
	if c != nil {
		if raw, ok := c.Get(key); ok {
			var decoded T
			if err := decodeCachedJSON(raw, &decoded); err == nil {
				return decoded, nil
			}
		}
	}

	if c == nil {
		return loader(ctx)
	}

	c.inflightMu.Lock()
	if call, ok := c.inflight[key]; ok {
		c.inflightMu.Unlock()
		select {
		case <-call.done:
			if call.err != nil {
				return zero, call.err
			}
			var decoded T
			if err := decodeCachedJSON(call.val, &decoded); err != nil {
				return zero, err
			}
			return decoded, nil
		case <-ctx.Done():
			return zero, ctx.Err()
		}
	}

	// Close the cache-miss/registration window while owning the in-flight lock.
	if raw, ok := c.Get(key); ok {
		var decoded T
		if err := decodeCachedJSON(raw, &decoded); err == nil {
			c.inflightMu.Unlock()
			return decoded, nil
		}
	}
	call := &inflightCall{done: make(chan struct{})}
	c.inflight[key] = call
	c.inflightMu.Unlock()

	// Always release waiters, including if a loader panics and the request handler recovers.
	call.err = errors.New("cache load did not complete")
	defer func() {
		c.inflightMu.Lock()
		delete(c.inflight, key)
		close(call.done)
		c.inflightMu.Unlock()
	}()
	res, err := loader(ctx)
	if ctx.Err() != nil {
		err = ctx.Err()
	}
	if err == nil {
		var raw []byte
		raw, err = json.Marshal(res)
		if err == nil {
			call.val = raw
			c.Set(key, raw, ttl)
		}
	}
	call.err = err
	if ctx.Err() != nil {
		call.err = errCacheOwnerCanceled
	}

	if err != nil {
		return zero, err
	}
	var decoded T
	if err := decodeCachedJSON(call.val, &decoded); err != nil {
		return zero, err
	}
	return decoded, nil
}

func (c *Cache) pruneExpiredLocked() {
	now := c.now()
	for elem := c.order.Back(); elem != nil; {
		prev := elem.Prev()
		entry := elem.Value.(*cacheEntry)
		if !entry.expiresAt.IsZero() && !now.Before(entry.expiresAt) {
			c.removeElement(elem)
		}
		elem = prev
	}
}

func (c *Cache) removeElement(elem *list.Element) {
	c.order.Remove(elem)
	entry := elem.Value.(*cacheEntry)
	c.bytes -= len(entry.value)
	delete(c.items, entry.key)
}
