package cdf

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"math"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"sync"
	"sync/atomic"
)

const defaultMaxPageLimit = 1000
const maxConsecutiveEmptyPages = 10

// CursorResponse represents a cursor-paginated CDF list response.
type CursorResponse[T any] struct {
	Items      []T    `json:"items"`
	NextCursor string `json:"nextCursor"`
}

// FetchItems executes a single CDF request and returns the items slice.
func FetchItems[T any](ctx context.Context, client *Client, auth, method, path string, query url.Values, body any) ([]T, error) {
	var resp CursorResponse[T]
	if err := client.Do(ctx, auth, method, path, query, body, &resp); err != nil {
		return nil, err
	}
	return resp.Items, nil
}

// FetchAndPaginate pages through a cursor-paginated CDF endpoint up to fullLimit items.
// It stops cleanly on ctx cancellation and rejects repeated cursors to avoid infinite loops.
func FetchAndPaginate[T any](
	ctx context.Context,
	client *Client,
	auth, method, path string,
	query url.Values,
	body map[string]any,
	fullLimit int,
) ([]T, error) {
	cursor, _ := body["cursor"].(string)
	var pageBody map[string]any
	if method == http.MethodGet {
		query = maps.Clone(query)
		if query == nil {
			query = make(url.Values)
		}
		cursor = query.Get("cursor")
		query.Del("cursor")
		if fullLimit <= 0 {
			if n, err := strconv.Atoi(query.Get("limit")); err == nil && n > 0 {
				fullLimit = n
			}
		}
	} else {
		pageBody = maps.Clone(body)
		if pageBody == nil {
			pageBody = make(map[string]any)
		}
		delete(pageBody, "cursor")
		if fullLimit <= 0 {
			if n, ok := asPositiveInt(body["limit"]); ok {
				fullLimit = n
			}
		}
	}
	if fullLimit <= 0 {
		fullLimit = defaultMaxPageLimit
	}
	var all []T
	emptyPages := 0
	seenCursors := map[string]struct{}{cursor: {}}

	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		limit := min(defaultMaxPageLimit, fullLimit-len(all))
		var reqBody any
		if method == http.MethodGet {
			query.Set("limit", strconv.Itoa(limit))
			if cursor != "" {
				query.Set("cursor", cursor)
			}
		} else {
			pageBody["limit"] = limit
			if cursor != "" {
				pageBody["cursor"] = cursor
			}
			reqBody = pageBody
		}

		var page CursorResponse[T]
		if err := client.Do(ctx, auth, method, path, query, reqBody, &page); err != nil {
			return nil, err
		}
		all = append(all, page.Items...)

		if page.NextCursor == "" || len(all) >= fullLimit {
			break
		}
		if _, dup := seenCursors[page.NextCursor]; dup {
			return nil, fmt.Errorf("cdf pagination repeated cursor: %q", page.NextCursor)
		}
		if len(page.Items) == 0 {
			emptyPages++
			if emptyPages >= maxConsecutiveEmptyPages {
				return nil, fmt.Errorf("CDF pagination returned %d consecutive empty pages with a next cursor", emptyPages)
			}
		} else {
			emptyPages = 0
		}
		seenCursors[page.NextCursor] = struct{}{}
		cursor = page.NextCursor
	}

	if len(all) > fullLimit {
		all = all[:fullLimit]
	}
	return all, nil
}

// Chunk splits items into contiguous slices of at most size elements.
func Chunk[T any](items []T, size int) [][]T {
	if len(items) == 0 {
		return nil
	}
	if size <= 0 {
		size = len(items)
	}
	return slices.Collect(slices.Chunk(items, size))
}

// BatchDo applies fn across chunks concurrently (bounded by maxConcurrency) and
// returns the concatenated results in input chunk order.
func BatchDo[T any, R any](
	ctx context.Context,
	items []T,
	chunkSize int,
	maxConcurrency int,
	fn func(context.Context, []T) ([]R, error),
) ([]R, error) {
	chunks := Chunk(items, chunkSize)
	if len(chunks) == 0 {
		return nil, nil
	}
	if maxConcurrency <= 0 {
		maxConcurrency = 4
	}
	if len(chunks) < maxConcurrency {
		maxConcurrency = len(chunks)
	}

	batchCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	results := make([][]R, len(chunks))
	var wg sync.WaitGroup
	var next atomic.Int64
	var errOnce sync.Once
	var firstErr error
	for range maxConcurrency {
		wg.Go(func() {
			for batchCtx.Err() == nil {
				i := next.Add(1) - 1
				if i >= int64(len(chunks)) {
					return
				}
				out, err := fn(batchCtx, chunks[i])
				if err != nil {
					errOnce.Do(func() { firstErr = err; cancel() })
					return
				}
				results[i] = out
			}
		})
	}

	wg.Wait()
	if firstErr != nil {
		return nil, firstErr
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	return slices.Concat(results...), nil
}

func asPositiveInt(v any) (int, bool) {
	switch n := v.(type) {
	case int:
		if n > 0 {
			return n, true
		}
	case int64:
		if n > 0 && n <= math.MaxInt {
			return int(n), true
		}
	case json.Number:
		if i, err := n.Int64(); err == nil && i > 0 && i <= math.MaxInt {
			return int(i), true
		}
	case float64:
		if n > 0 && n < 1<<(strconv.IntSize-1) && math.Trunc(n) == n {
			return int(n), true
		}
	}
	return 0, false
}
