package plugin

import (
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

// CDF uses a 31-day upper bound for month-sized aggregate buckets.
const monthMS = 31 * dayMS
const defaultFillMultiple = 4

// GapFillConfig mirrors the TypeScript GapFill union on CogniteQuery.
type GapFillConfig struct {
	Mode     string   `json:"mode"`
	Multiple *float64 `json:"multiple,omitempty"`
	Limit    string   `json:"limit,omitempty"`
}

func parseGapFillConfig(raw json.RawMessage) *GapFillConfig {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" || trimmed == "null" || trimmed == "{}" {
		return nil
	}
	var cfg GapFillConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil
	}
	return &cfg
}

var (
	durationRe      = regexp.MustCompile(`^(\d*)([a-z]+)$`)
	fillUnitMSMap   = map[string]int64{"s": secondMS, "second": secondMS, "m": minuteMS, "minute": minuteMS, "h": hourMS, "hour": hourMS, "d": dayMS, "day": dayMS}
	granUnitMSMap   = map[string]int64{"s": secondMS, "second": secondMS, "m": minuteMS, "minute": minuteMS, "h": hourMS, "hour": hourMS, "d": dayMS, "day": dayMS, "mo": monthMS, "month": monthMS}
	fillUnitsLadder = []struct {
		unit string
		size int64
		max  int64
	}{
		{"d", dayMS, 100000},
		{"h", hourMS, 100000},
		{"m", minuteMS, 120},
		{"s", secondMS, 120},
	}
)

func parseDurationWithUnits(text string, units map[string]int64) (int64, bool) {
	m := durationRe.FindStringSubmatch(strings.TrimSpace(text))
	if len(m) != 3 {
		return 0, false
	}
	unitSize, ok := units[m[2]]
	if !ok {
		return 0, false
	}
	count := int64(1)
	if m[1] != "" {
		n, err := strconv.ParseInt(m[1], 10, 64)
		if err != nil {
			return 0, false
		}
		count = n
	}
	if count <= 0 || count > math.MaxInt64/unitSize {
		return 0, false
	}
	return count * unitSize, true
}

func granularityToMS(granularity string) (int64, bool) {
	return parseDurationWithUnits(granularity, granUnitMSMap)
}

func fillLimitToMS(limit string) (int64, bool) {
	return parseDurationWithUnits(limit, fillUnitMSMap)
}

func formatFillLimit(milliseconds int64) string {
	ms := max(milliseconds, 1)
	for _, u := range fillUnitsLadder {
		if ms%u.size == 0 && ms/u.size <= u.max {
			return fmt.Sprintf("%d%s", ms/u.size, u.unit)
		}
	}
	for i := len(fillUnitsLadder) - 1; i >= 0; i-- {
		u := fillUnitsLadder[i]
		count := 1 + (ms-1)/u.size
		if count <= u.max {
			return fmt.Sprintf("%d%s", count, u.unit)
		}
	}
	return fmt.Sprintf("%d%s", fillUnitsLadder[0].max, fillUnitsLadder[0].unit)
}

func withinUnitCap(limit string) bool {
	m := durationRe.FindStringSubmatch(strings.TrimSpace(limit))
	if len(m) != 3 {
		return false
	}
	count := int64(1)
	if m[1] != "" {
		n, err := strconv.ParseInt(m[1], 10, 64)
		if err != nil {
			return false
		}
		count = n
	}
	short := m[2][:1]
	for _, u := range fillUnitsLadder {
		if u.unit == short {
			return count <= u.max
		}
	}
	return false
}

func resolveFillLimit(cfg *GapFillConfig, granularity, aggregation string) (string, string) {
	if cfg == nil || (cfg.Mode != "granularity" && cfg.Mode != "duration") {
		return "", ""
	}
	if aggregation == "totalVariation" {
		return "", fmt.Sprintf("Gap filling is not available for %s, so it was not applied.", aggregation)
	}
	granMS, ok := granularityToMS(granularity)
	if !ok {
		return "", fmt.Sprintf("Gap filling was not applied: granularity '%s' is not recognised.", granularity)
	}

	if cfg.Mode == "granularity" {
		multiple := float64(defaultFillMultiple)
		if cfg.Multiple != nil {
			multiple = *cfg.Multiple
		}
		if math.IsNaN(multiple) || math.IsInf(multiple, 0) || multiple != math.Trunc(multiple) || multiple < 1 {
			return "", fmt.Sprintf("Gap filling was not applied: the multiple must be a whole number of 1 or more, not '%s'.", strconv.FormatFloat(multiple, 'f', -1, 64))
		}
		largest := fillUnitsLadder[0]
		maxMS := largest.max * largest.size
		if multiple > float64(maxMS/granMS) {
			return formatFillLimit(maxMS), ""
		}
		return formatFillLimit(int64(multiple) * granMS), ""
	}

	limit := strings.TrimSpace(cfg.Limit)
	limitMS, ok := fillLimitToMS(limit)
	if !ok {
		return "", fmt.Sprintf("Gap filling was not applied: '%s' is not a fill limit. Use a whole number of s, m, h or d, for example 4h.", limit)
	}
	if limitMS < granMS {
		raised := formatFillLimit(granMS)
		return raised, fmt.Sprintf("Fill limit %s is shorter than the granularity (%s), so %s was used.", limit, granularity, raised)
	}
	if withinUnitCap(limit) {
		return limit, ""
	}
	rewritten := formatFillLimit(limitMS)
	if rMS, ok := fillLimitToMS(rewritten); ok && rMS == limitMS {
		return rewritten, ""
	}
	return rewritten, fmt.Sprintf("Fill limit %s cannot be sent as is (at most 120 seconds or minutes), so %s was used.", limit, rewritten)
}

func resolveTargetFill(tab, aggregation, granularity string, gapFill *GapFillConfig, dpType string, intervalMS int64) (string, string) {
	if dpType != "data" || (tab != "CogniteTimeSeries" && tab != "Data Models") || aggregation == "" || aggregation == "none" {
		return "", ""
	}
	return resolveFillLimit(gapFill, resolveDatapointsGranularity(granularity, intervalMS), aggregation)
}
