package plugin

import (
	"strings"
	"testing"
	"time"
)

func TestTimeExpressionGrammar(t *testing.T) {
	hour := int64(3600 * 1000)
	day := 24 * hour
	end := time.Date(2026, 8, 27, 12, 0, 0, 0, time.UTC).UnixMilli()
	start := end - 6*hour
	sevenDays := 7 * day
	ctx := TimeExpressionContext{
		StartTime:              &start,
		EndTime:                &end,
		Now:                    &end,
		MaxFilteringIntervalMs: &sevenDays,
	}

	if ms, ok := parseDurationMs("PT168H"); !ok || ms != float64(7*day) {
		t.Fatalf("PT168H = (%g, %v)", ms, ok)
	}
	if ms, ok := parseDurationMs("P1Y"); !ok || ms != float64(365*day) {
		t.Fatalf("P1Y = (%g, %v)", ms, ok)
	}
	if _, ok := parseDurationMs("P"); ok {
		t.Fatalf("expected P to fail")
	}

	r := evaluateTimeExpression("{{endTime}} - 2 * {{maxFilteringInterval}}", ctx)
	if !r.OK || r.MS != end-2*sevenDays {
		t.Fatalf("stacked window = %+v", r)
	}
	if r := evaluateTimeExpression("1d + {{startTime}}", ctx); !r.OK || r.MS != start+day {
		t.Fatalf("commutative sum = %+v", r)
	}
	if r := evaluateTimeExpression("{{endTime}} - (1d + 12h)", ctx); !r.OK || r.MS != end-day-12*hour {
		t.Fatalf("parens = %+v", r)
	}
	if r := evaluateTimeExpression("{{endTime}} - {{maxFilteringInterval}} / 7", ctx); !r.OK || r.MS != end-day {
		t.Fatalf("div = %+v", r)
	}

	// Offset-less datetime interpreted strictly as UTC, explicit offset respected, bare date UTC midnight
	naive := evaluateTimeExpression("2026-08-01T06:00:00", TimeExpressionContext{})
	utc := evaluateTimeExpression("2026-08-01T06:00:00Z", TimeExpressionContext{})
	plus2 := evaluateTimeExpression("2026-08-01T08:00:00+02:00", TimeExpressionContext{})
	if !naive.OK || !utc.OK || !plus2.OK || naive.MS != utc.MS || plus2.MS != utc.MS {
		t.Fatalf("UTC instant parity mismatch: naive=%+v utc=%+v plus2=%+v", naive, utc, plus2)
	}
	bare := evaluateTimeExpression("2026-08-01", TimeExpressionContext{})
	midnight := evaluateTimeExpression("2026-08-01T00:00:00Z", TimeExpressionContext{})
	if !bare.OK || bare.MS != midnight.MS {
		t.Fatalf("bare date mismatch: bare=%+v midnight=%+v", bare, midnight)
	}

	// Errors
	for _, tc := range []struct {
		expr string
		c    TimeExpressionContext
		want string
	}{
		{"1d + 2h", ctx, "duration"},
		{"5", ctx, "number"},
		{"{{endTime}} - {{startTime}}", ctx, "duration"},
		{"{{endTime}} * 2", ctx, "multiply"},
		{"{{bogus}}", ctx, "Unknown variable"},
		{"{{maxFilteringInterval}}", TimeExpressionContext{EndTime: &end}, "only available on streams"},
		{"{{startTime}}", TimeExpressionContext{}, "dashboard time range"},
		{"({{endTime}}", ctx, "parenthesis"},
		{"{{endTime}} $ 1d", ctx, "Unexpected character"},
		{"1d / 0", ctx, "zero"},
	} {
		res := evaluateTimeExpression(tc.expr, tc.c)
		if res.OK || !strings.Contains(strings.ToLower(res.Error), strings.ToLower(tc.want)) {
			t.Fatalf("expr %q => got %+v, want error containing %q", tc.expr, res, tc.want)
		}
	}
}

func TestTimeExpressionBoundaries(t *testing.T) {
	for _, input := range []string{"9223372036854775807w", "P106751991168DT24H"} {
		if _, ok := parseDurationMs(input); ok {
			t.Errorf("accepted overflowing duration %q", input)
		}
	}
	if result := evaluateTimeExpression(strings.Repeat("-", 4097)+"2026-01-01", TimeExpressionContext{}); result.OK {
		t.Error("accepted oversized expression")
	}
	if result := evaluateTimeExpression("1970-01-01 - 1ms / 2", TimeExpressionContext{}); !result.OK || result.MS != 0 {
		t.Errorf("negative half millisecond resolved to %+v", result)
	}
	for _, input := range []string{"2026-10-25T02:30:00+02:00", "2026-10-25T01:30:00+01:00"} {
		result := evaluateTimeExpression(input, TimeExpressionContext{})
		if !result.OK || result.ISO != "2026-10-25T00:30:00.000Z" {
			t.Errorf("%s resolved to %+v", input, result)
		}
	}
}

func TestRecordTimeExpressionFrontendParity(t *testing.T) {
	end := int64(0)
	ctx := TimeExpressionContext{EndTime: &end}
	before := time.Now().UnixMilli()
	if r := evaluateTimeExpression("{{now}}", ctx); !r.OK || r.MS < before || r.MS > time.Now().UnixMilli() {
		t.Errorf("current time with historical range = %+v", r)
	}
	ctx.Now = &end
	for expr, want := range map[string]int64{
		"{{now}}":                      0,
		"{{endTime}} - 1.5h":           -5400000,
		"{{endTime}} - PT1.5H":         -5400000,
		"{{endTime}} + 0.25ms * 4":     1,
		"{{endTime}} + PT0.00025S * 4": 1,
		"1970-01-01T06:30Z":            23400000,
		"1970-01-01 06:30:00":          23400000,
		"1970-01-01 08:30+0200":        23400000,
	} {
		if r := evaluateTimeExpression(expr, ctx); !r.OK || r.MS != want {
			t.Errorf("%s = %+v, want %d", expr, r, want)
		}
	}
}
