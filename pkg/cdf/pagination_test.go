package cdf

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
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
