package plugin

import (
	"fmt"
	"math"
	"strings"
)

const (
	secondMS int64 = 1000
	minuteMS int64 = 60 * secondMS
	hourMS   int64 = 60 * minuteMS
	dayMS    int64 = 24 * hourMS
)

var autoIntervalLadderMS = []int64{
	10, 20, 50, 100, 200, 500,
	secondMS, 2 * secondMS, 5 * secondMS, 10 * secondMS, 15 * secondMS, 30 * secondMS,
	minuteMS, 2 * minuteMS, 5 * minuteMS, 10 * minuteMS, 15 * minuteMS, 30 * minuteMS,
	hourMS, 2 * hourMS, 3 * hourMS, 6 * hourMS, 12 * hourMS,
	dayMS, 2 * dayMS, 7 * dayMS, 14 * dayMS, 30 * dayMS, 90 * dayMS, 180 * dayMS, 365 * dayMS,
}

func autoStepFactor(interval string) (int64, bool) {
	v := strings.ToLower(strings.TrimSpace(interval))
	switch v {
	case "", "$__interval", "auto":
		return 1, true
	case "auto:fewer":
		return 4, true
	default:
		return 0, false
	}
}

func snapToLadder(ms, floor float64) int64 {
	for _, step := range autoIntervalLadderMS {
		sf := float64(step)
		if sf >= ms && sf > floor {
			return step
		}
	}
	return autoIntervalLadderMS[len(autoIntervalLadderMS)-1]
}

func formatFixedInterval(ms int64) string {
	amount := max(ms, 1)
	for _, u := range []struct {
		size   int64
		suffix string
	}{{dayMS, "d"}, {hourMS, "h"}, {minuteMS, "m"}, {secondMS, "s"}} {
		if amount%u.size == 0 {
			return fmt.Sprintf("%d%s", amount/u.size, u.suffix)
		}
	}
	return fmt.Sprintf("%dms", amount)
}

func toGranularityWithLowerBound(intervalMS int64, lowerBound int64) string {
	ms := max(intervalMS, lowerBound)
	for _, u := range []struct {
		size   int64
		suffix string
	}{{dayMS, "d"}, {hourMS, "h"}, {minuteMS, "m"}, {secondMS, "s"}} {
		if ms >= u.size {
			return fmt.Sprintf("%d%s", int64(math.Floor(float64(ms)/float64(u.size)+0.5)), u.suffix)
		}
	}
	return fmt.Sprintf("%dms", ms)
}

func resolveDatapointsGranularity(granularity string, intervalMS int64) string {
	factor, auto := autoStepFactor(granularity)
	if !auto {
		return strings.TrimSpace(granularity)
	}
	if factor == 1 {
		return toGranularityWithLowerBound(intervalMS, secondMS)
	}
	base := max(intervalMS, secondMS)
	return formatFixedInterval(snapToLadder(float64(base)*float64(factor), 0))
}

func autoBucketInterval(spanMS, maxDataPoints, maxBuckets, factor int64) string {
	span := float64(max(spanMS, 1))
	points := float64(max(maxDataPoints, 1))
	var floor float64
	if maxBuckets > 0 {
		floor = span / float64(maxBuckets)
	}
	if factor <= 0 {
		factor = 1
	}
	return formatFixedInterval(snapToLadder((span/points)*float64(factor), floor))
}
