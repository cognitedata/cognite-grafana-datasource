package cdf

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestGETPaginationUsesQueryParameters(t *testing.T) {
	query := url.Values{"cursor": {"initial"}, "limit": {"3"}, "filter": {"a", "b"}}
	original := query.Encode()
	client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if r.Method != http.MethodGet || r.Body != http.NoBody || !slices.Equal(q["filter"], []string{"a", "b"}) {
			t.Error("expected bodyless GET with both filter values")
		}
		switch q.Get("cursor") {
		case "initial":
			if q.Get("limit") != "3" {
				t.Errorf("first limit: %s", q.Get("limit"))
			}
			fmt.Fprint(w, `{"items":[1,2],"nextCursor":"next+/="}`)
		case "next+/=":
			if q.Get("limit") != "1" {
				t.Errorf("remaining limit: %s", q.Get("limit"))
			}
			fmt.Fprint(w, `{"items":[3],"nextCursor":"unused"}`)
		default:
			t.Errorf("unexpected cursor %q", q.Get("cursor"))
			w.WriteHeader(http.StatusBadRequest)
		}
	}, false)
	items, err := FetchAndPaginate[int](t.Context(), client, "Bearer test", http.MethodGet, "/models/views", query, nil, 0)
	if err != nil || !slices.Equal(items, []int{1, 2, 3}) || query.Encode() != original {
		t.Fatalf("items=%v query=%v err=%v", items, query, err)
	}
}

func TestFetchAndPaginateAndRepeatedCursor(t *testing.T) {
	client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		switch cursor, _ := body["cursor"].(string); cursor {
		case "":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"items":      []string{"a", "b"},
				"nextCursor": "c1",
			})
		case "c1":
			if body["limit"] != float64(1) {
				t.Errorf("expected one remaining item, got limit %v", body["limit"])
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"items":      []string{"c", "d"},
				"nextCursor": "c2",
			})
		case "c2":
			t.Error("continued after reaching the requested limit")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"items":      []string{"e"},
				"nextCursor": "",
			})
		}
	}, false)

	items, err := FetchAndPaginate[string](context.Background(), client, "Bearer alice", http.MethodPost, "/models/instances/list", nil, map[string]any{"model": "x"}, 3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 3 || items[0] != "a" || items[1] != "b" || items[2] != "c" {
		t.Fatalf("expected [a b c], got %v", items)
	}

	// Repeated cursor detection
	repeatClient, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"items":      []string{"x"},
			"nextCursor": "stuck-cursor",
		})
	}, false)
	_, err = FetchAndPaginate[string](context.Background(), repeatClient, "Bearer alice", http.MethodPost, "/models/instances/list", nil, nil, 100)
	if err == nil || !strings.Contains(err.Error(), "repeated cursor") {
		t.Fatalf("expected repeated cursor error, got %v", err)
	}

	// Cancelled context stops cleanly
	cancelledCtx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := FetchAndPaginate[string](cancelledCtx, client, "Bearer alice", http.MethodPost, "/models/instances/list", nil, nil, 10); !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestBatchDoOrderingAndErrors(t *testing.T) {
	items := []int{1, 2, 3, 4, 5, 6, 7}
	var active atomic.Int32
	var maxSeen atomic.Int32
	out, err := BatchDo[int, string](context.Background(), items, 2, 2, func(ctx context.Context, batch []int) ([]string, error) {
		cur := active.Add(1)
		for {
			prev := maxSeen.Load()
			if cur <= prev || maxSeen.CompareAndSwap(prev, cur) {
				break
			}
		}
		time.Sleep(10 * time.Millisecond)
		active.Add(-1)
		res := make([]string, len(batch))
		for i, v := range batch {
			res[i] = fmt.Sprintf("v%d", v)
		}
		return res, nil
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if maxSeen.Load() > 2 {
		t.Fatalf("concurrency exceeded cap: %d", maxSeen.Load())
	}
	if strings.Join(out, ",") != "v1,v2,v3,v4,v5,v6,v7" {
		t.Fatalf("unexpected order: %v", out)
	}

	boom := errors.New("chunk boom")
	if _, err := BatchDo[int, int](context.Background(), items, 2, 2, func(ctx context.Context, batch []int) ([]int, error) {
		if batch[0] == 3 {
			return nil, boom
		}
		return batch, nil
	}); !errors.Is(err, boom) {
		t.Fatalf("expected chunk error, got %v", err)
	}
}

func TestPositivePaginationLimit(t *testing.T) {
	for _, v := range []any{3.7, float64(1 << (strconv.IntSize - 1)), json.Number("invalid"), int(-1), math.NaN()} {
		if n, ok := asPositiveInt(v); ok || n != 0 {
			t.Errorf("invalid %v returned %d, %v", v, n, ok)
		}
	}
	for _, v := range []any{int64(math.MaxInt), json.Number(strconv.Itoa(math.MaxInt)), float64(3)} {
		if _, ok := asPositiveInt(v); !ok {
			t.Errorf("rejected valid limit %v", v)
		}
	}
	if strconv.IntSize == 32 {
		for _, v := range []any{int64(1<<32 + 5), json.Number("4294967301")} {
			if n, ok := asPositiveInt(v); ok || n != 0 {
				t.Errorf("overflow %v returned %d, %v", v, n, ok)
			}
		}
		if n, ok := asPositiveInt(float64(math.MaxInt32)); !ok || n != math.MaxInt32 {
			t.Fatal("rejected 32-bit maximum")
		}
	}
}

func TestInvalidLimitAndEmptyCursorOnFirstRequest(t *testing.T) {
	for _, method := range []string{http.MethodGet, http.MethodPost} {
		t.Run(method, func(t *testing.T) {
			query := url.Values{}
			body := map[string]any{}
			if method == http.MethodGet {
				query.Set("limit", "999999999999999999999")
				query.Set("cursor", "")
			} else {
				body["limit"] = 3.7
				body["cursor"] = ""
			}
			client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
				if method == http.MethodGet {
					q := r.URL.Query()
					if q.Has("cursor") || q.Get("limit") != strconv.Itoa(defaultMaxPageLimit) {
						t.Errorf("unexpected query %v", q)
					}
				} else {
					var payload map[string]any
					if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
						t.Error(err)
					}
					if _, ok := payload["cursor"]; ok || payload["limit"] != float64(defaultMaxPageLimit) {
						t.Errorf("unexpected body %v", payload)
					}
				}
				fmt.Fprint(w, `{"items":[]}`)
			}, false)
			_, err := FetchAndPaginate[int](t.Context(), client, "Bearer test", method, "/models/views", query, body, 0)
			if err != nil {
				t.Fatal(err)
			}
			if method == http.MethodGet && (!query.Has("cursor") || query.Get("limit") != "999999999999999999999") {
				t.Fatal("input query changed")
			}
			if method == http.MethodPost && (body["cursor"] != "" || body["limit"] != 3.7) {
				t.Fatal("input body changed")
			}
		})
	}
}

func TestConsecutiveEmptyPages(t *testing.T) {
	for _, progress := range []bool{false, true} {
		calls := 0
		client, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
			calls++
			var items []int
			if progress && calls%maxConsecutiveEmptyPages == 0 {
				items = []int{calls}
			}
			if calls > 2*maxConsecutiveEmptyPages {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			json.NewEncoder(w).Encode(CursorResponse[int]{Items: items, NextCursor: strconv.Itoa(calls)})
		}, false)
		items, err := FetchAndPaginate[int](t.Context(), client, "Bearer test", http.MethodGet, "/models/views", nil, nil, 2)
		if progress {
			if err != nil || !slices.Equal(items, []int{maxConsecutiveEmptyPages, 2 * maxConsecutiveEmptyPages}) {
				t.Fatalf("progress: %v, %v", items, err)
			}
		} else if err == nil || !strings.Contains(err.Error(), "consecutive empty pages") || calls != maxConsecutiveEmptyPages {
			t.Fatalf("empty pages: calls=%d err=%v", calls, err)
		}
	}
}
