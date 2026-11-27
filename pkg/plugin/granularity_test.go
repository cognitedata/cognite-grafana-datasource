package plugin

import (
	"strings"
	"testing"
)

func TestDatapointsGranularity(t *testing.T) {
	for _, tc := range []struct {
		setting string
		ms      int64
		want    string
	}{
		{"", 0, "1s"}, {" AUTO ", 1500, "2s"}, {"$__interval", 90 * minuteMS, "2h"},
		{"auto:fewer", 50, "5s"}, {"auto:fewer", 10 * minuteMS, "1h"},
		{"auto:fewer", 48 * hourMS, "14d"}, {" 12h ", 0, "12h"},
	} {
		if got := resolveDatapointsGranularity(tc.setting, tc.ms); got != tc.want {
			t.Errorf("granularity(%q, %d) = %s, want %s", tc.setting, tc.ms, got, tc.want)
		}
	}
}

func TestHistogramBucketInterval(t *testing.T) {
	for _, tc := range []struct {
		span, points, ceiling, factor int64
		want                          string
	}{
		{7 * dayMS, 1000, 0, 1, "15m"}, {7 * dayMS, 1000, 0, 4, "1h"},
		{dayMS, 1000000, 100, 4, "15m"}, {minuteMS, 1000, 60, 1, "2s"},
		{0, 0, 0, 1, "10ms"},
	} {
		if got := autoBucketInterval(tc.span, tc.points, tc.ceiling, tc.factor); got != tc.want {
			t.Errorf("bucket interval for %+v = %s", tc, got)
		}
	}
}

func TestTargetFill(t *testing.T) {
	for _, tc := range []struct {
		tab, agg, gran, kind, config, limit, warning string
	}{
		{"CogniteTimeSeries", "average", "auto", "data", `{"mode":"granularity"}`, "4s", ""},
		{"Data Models", "sum", "mo", "data", `{"mode":"granularity","multiple":2}`, "62d", ""},
		{"Data Models", "sum", "1m", "data", `{"mode":"duration","limit":"120second"}`, "120second", ""},
		{"Data Models", "sum", "h", "data", `{"mode":"duration","limit":"1m"}`, "1h", "shorter than"},
		{"Data Models", "sum", "m", "data", `{"mode":"duration","limit":"180m"}`, "3h", ""},
		{"Data Models", "sum", "m", "data", `{"mode":"duration","limit":"121m"}`, "3h", "cannot be sent"},
		{"Data Models", "sum", "s", "data", `{"mode":"granularity","multiple":1e100}`, "100000d", ""},
		{"Data Models", "sum", "s", "data", `{"mode":"granularity","multiple":0.5}`, "", "whole number"},
		{"Data Models", "sum", "m", "data", `{"mode":"duration","limit":"1mo"}`, "", "not a fill limit"},
		{"Data Models", "totalVariation", "m", "data", `{"mode":"granularity"}`, "", "not available"},
		{"Data Models", "none", "m", "data", `{"mode":"granularity"}`, "", ""},
		{"Data Models", "sum", "m", "latest", `{"mode":"granularity"}`, "", ""},
		{"TimeSeries", "sum", "m", "data", `{"mode":"granularity"}`, "", ""},
	} {
		got, warning := resolveTargetFill(tc.tab, tc.agg, tc.gran, parseGapFillConfig([]byte(tc.config)), tc.kind, 1000)
		if got != tc.limit || (tc.warning == "" && warning != "") || !strings.Contains(warning, tc.warning) {
			t.Errorf("fill for %+v = (%q, %q)", tc, got, warning)
		}
	}
}
