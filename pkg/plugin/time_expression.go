package plugin

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
)

const (
	teSecondMS = int64(1000)
	teMinuteMS = 60 * teSecondMS
	teHourMS   = 60 * teMinuteMS
	teDayMS    = 24 * teHourMS
	teWeekMS   = 7 * teDayMS
	teMonthMS  = 30 * teDayMS
	teYearMS   = 365 * teDayMS
)

// TimeExpressionContext provides the anchor values resolved inside custom record time windows.
type TimeExpressionContext struct {
	StartTime              *int64
	EndTime                *int64
	Now                    *int64
	MaxFilteringIntervalMs *int64
}

// TimeExpressionResult mirrors the TypeScript evaluateTimeExpression return shape.
type TimeExpressionResult struct {
	OK    bool
	MS    int64
	ISO   string
	Error string
}

var (
	simpleDurationRe = regexp.MustCompile(`^(\d+)\s*(ms|s|m|h|d|w)$`)
	isoDurationRe    = regexp.MustCompile(`^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$`)
	isoInstantLexRe  = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?`)
	durationLexRe    = regexp.MustCompile(`^(?:P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?|\d+(?:ms|s|m|h|d|w))`)
	numberLexRe      = regexp.MustCompile(`^\d+(?:\.\d+)?`)
)

// parseDurationMs parses simple Grafana/CDF durations (e.g. "30m", "2w", "500ms")
// and ISO-8601 durations (e.g. "PT168H", "P1Y", "P7D") to milliseconds.
func parseDurationMs(raw string) (int64, bool) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return 0, false
	}
	if m := simpleDurationRe.FindStringSubmatch(strings.ToLower(s)); len(m) == 3 {
		n, err := strconv.ParseInt(m[1], 10, 64)
		if err != nil {
			return 0, false
		}
		scale := map[string]int64{"ms": 1, "s": teSecondMS, "m": teMinuteMS, "h": teHourMS, "d": teDayMS, "w": teWeekMS}[m[2]]
		if n > math.MaxInt64/scale {
			return 0, false
		}
		return n * scale, true
	}

	if m := isoDurationRe.FindStringSubmatch(s); len(m) == 8 {
		hasComponent := false
		for i := 1; i <= 7; i++ {
			if m[i] != "" {
				hasComponent = true
				break
			}
		}
		if !hasComponent {
			return 0, false
		}
		var total int64
		mults := [7]int64{teYearMS, teMonthMS, teWeekMS, teDayMS, teHourMS, teMinuteMS, teSecondMS}
		for i := 1; i <= 7; i++ {
			if m[i] == "" {
				continue
			}
			n, err := strconv.ParseInt(m[i], 10, 64)
			if err != nil {
				return 0, false
			}
			if n > (math.MaxInt64-total)/mults[i-1] {
				return 0, false
			}
			total += n * mults[i-1]
		}
		return total, true
	}
	return 0, false
}

func parseUTCInstantMs(literal string) (int64, bool) {
	s := strings.TrimSpace(literal)
	if len(s) == 10 && s[4] == '-' && s[7] == '-' {
		t, err := time.Parse("2006-01-02", s)
		if err != nil {
			return 0, false
		}
		return t.UTC().UnixMilli(), true
	}
	// If offset-less datetime, append Z so it interprets strictly in UTC.
	if len(s) >= 19 && s[10] == 'T' {
		rest := s[11:]
		hasZone := strings.ContainsAny(rest, "Zz+-")
		candidate := s
		if !hasZone {
			candidate += "Z"
		}
		if t, err := time.Parse(time.RFC3339Nano, candidate); err == nil {
			return t.UTC().UnixMilli(), true
		}
		// Handle +0200 style offset without colon if provided.
		if t, err := time.Parse("2006-01-02T15:04:05.999999999-0700", s); err == nil {
			return t.UTC().UnixMilli(), true
		}
		if t, err := time.Parse("2006-01-02T15:04:05-0700", s); err == nil {
			return t.UTC().UnixMilli(), true
		}
	}
	return 0, false
}

type teValueKind int

const (
	teInstant teValueKind = iota
	teDuration
	teNumber
)

type teValue struct {
	Kind teValueKind
	Val  float64
}

type teTokenKind int

const (
	teTokEOF teTokenKind = iota
	teTokValue
	teTokOp
	teTokLParen
	teTokRParen
)

type teToken struct {
	Kind teTokenKind
	Val  teValue
	Op   byte
}

func tokenizeTimeExpression(expr string, ctx TimeExpressionContext) ([]teToken, error) {
	var tokens []teToken
	i := 0
	n := len(expr)
	for i < n {
		if unicode.IsSpace(rune(expr[i])) {
			i++
			continue
		}
		ch := expr[i]
		if ch == '{' && i+1 < n && expr[i+1] == '{' {
			end := strings.Index(expr[i+2:], "}}")
			if end < 0 {
				return nil, fmt.Errorf("Unterminated variable placeholder")
			}
			rawVar := strings.TrimSpace(expr[i+2 : i+2+end])
			i += 2 + end + 2
			val, err := resolveTimeAnchor(rawVar, ctx)
			if err != nil {
				return nil, err
			}
			tokens = append(tokens, teToken{Kind: teTokValue, Val: val})
			continue
		}
		if ch == '+' || ch == '-' || ch == '*' || ch == '/' {
			tokens = append(tokens, teToken{Kind: teTokOp, Op: ch})
			i++
			continue
		}
		if ch == '(' {
			tokens = append(tokens, teToken{Kind: teTokLParen})
			i++
			continue
		}
		if ch == ')' {
			tokens = append(tokens, teToken{Kind: teTokRParen})
			i++
			continue
		}
		rest := expr[i:]
		if loc := isoInstantLexRe.FindStringIndex(rest); loc != nil {
			lit := rest[:loc[1]]
			ms, ok := parseUTCInstantMs(lit)
			if !ok {
				return nil, fmt.Errorf("Invalid timestamp %q", lit)
			}
			tokens = append(tokens, teToken{Kind: teTokValue, Val: teValue{Kind: teInstant, Val: float64(ms)}})
			i += loc[1]
			continue
		}
		if loc := durationLexRe.FindStringIndex(rest); loc != nil {
			lit := rest[:loc[1]]
			if ms, ok := parseDurationMs(lit); ok {
				tokens = append(tokens, teToken{Kind: teTokValue, Val: teValue{Kind: teDuration, Val: float64(ms)}})
				i += loc[1]
				continue
			}
		}
		if loc := numberLexRe.FindStringIndex(rest); loc != nil {
			lit := rest[:loc[1]]
			f, err := strconv.ParseFloat(lit, 64)
			if err != nil || math.IsNaN(f) || math.IsInf(f, 0) {
				return nil, fmt.Errorf("Invalid number %q", lit)
			}
			tokens = append(tokens, teToken{Kind: teTokValue, Val: teValue{Kind: teNumber, Val: f}})
			i += loc[1]
			continue
		}
		return nil, fmt.Errorf("Unexpected character %q", string(ch))
	}
	tokens = append(tokens, teToken{Kind: teTokEOF})
	return tokens, nil
}

func resolveTimeAnchor(name string, ctx TimeExpressionContext) (teValue, error) {
	switch name {
	case "startTime":
		if ctx.StartTime == nil {
			return teValue{}, fmt.Errorf("\"{{startTime}}\" requires a dashboard time range")
		}
		return teValue{Kind: teInstant, Val: float64(*ctx.StartTime)}, nil
	case "endTime":
		if ctx.EndTime == nil {
			return teValue{}, fmt.Errorf("\"{{endTime}}\" requires a dashboard time range")
		}
		return teValue{Kind: teInstant, Val: float64(*ctx.EndTime)}, nil
	case "now":
		if ctx.Now != nil {
			return teValue{Kind: teInstant, Val: float64(*ctx.Now)}, nil
		}
		if ctx.EndTime != nil {
			return teValue{Kind: teInstant, Val: float64(*ctx.EndTime)}, nil
		}
		return teValue{}, fmt.Errorf("\"{{now}}\" requires a dashboard time range")
	case "maxFilteringInterval":
		if ctx.MaxFilteringIntervalMs == nil || *ctx.MaxFilteringIntervalMs <= 0 {
			return teValue{}, fmt.Errorf("{{maxFilteringInterval}} is only available on streams with a filtering interval limit")
		}
		return teValue{Kind: teDuration, Val: float64(*ctx.MaxFilteringIntervalMs)}, nil
	default:
		return teValue{}, fmt.Errorf("Unknown variable \"{{%s}}\"", name)
	}
}

type teParser struct {
	tokens []teToken
	pos    int
}

func (p *teParser) peek() teToken {
	if p.pos >= len(p.tokens) {
		return teToken{Kind: teTokEOF}
	}
	return p.tokens[p.pos]
}

func (p *teParser) next() teToken {
	t := p.peek()
	if p.pos < len(p.tokens) {
		p.pos++
	}
	return t
}

func (p *teParser) parseAddSub() (teValue, error) {
	left, err := p.parseMulDiv()
	if err != nil {
		return teValue{}, err
	}
	for p.peek().Kind == teTokOp && (p.peek().Op == '+' || p.peek().Op == '-') {
		op := p.next().Op
		right, err := p.parseMulDiv()
		if err != nil {
			return teValue{}, err
		}
		left, err = applyTeAddSub(op, left, right)
		if err != nil {
			return teValue{}, err
		}
	}
	return left, nil
}

func (p *teParser) parseMulDiv() (teValue, error) {
	left, err := p.parseUnary()
	if err != nil {
		return teValue{}, err
	}
	for p.peek().Kind == teTokOp && (p.peek().Op == '*' || p.peek().Op == '/') {
		op := p.next().Op
		right, err := p.parseUnary()
		if err != nil {
			return teValue{}, err
		}
		left, err = applyTeMulDiv(op, left, right)
		if err != nil {
			return teValue{}, err
		}
	}
	return left, nil
}

func (p *teParser) parseUnary() (teValue, error) {
	if p.peek().Kind == teTokOp && (p.peek().Op == '+' || p.peek().Op == '-') {
		op := p.next().Op
		v, err := p.parseUnary()
		if err != nil {
			return teValue{}, err
		}
		if v.Kind == teInstant {
			return teValue{}, fmt.Errorf("Cannot apply unary %q to a timestamp", string(op))
		}
		if op == '-' {
			v.Val = -v.Val
		}
		return v, nil
	}
	return p.parsePrimary()
}

func (p *teParser) parsePrimary() (teValue, error) {
	tok := p.next()
	switch tok.Kind {
	case teTokValue:
		return tok.Val, nil
	case teTokLParen:
		v, err := p.parseAddSub()
		if err != nil {
			return teValue{}, err
		}
		if p.peek().Kind != teTokRParen {
			return teValue{}, fmt.Errorf("Missing closing parenthesis")
		}
		p.next()
		return v, nil
	default:
		return teValue{}, fmt.Errorf("Expected a value or opening parenthesis")
	}
}

func applyTeAddSub(op byte, a, b teValue) (teValue, error) {
	if op == '+' {
		switch {
		case a.Kind == teInstant && b.Kind == teDuration:
			return teValue{Kind: teInstant, Val: a.Val + b.Val}, nil
		case a.Kind == teDuration && b.Kind == teInstant:
			return teValue{Kind: teInstant, Val: b.Val + a.Val}, nil
		case a.Kind == teDuration && b.Kind == teDuration:
			return teValue{Kind: teDuration, Val: a.Val + b.Val}, nil
		case a.Kind == teNumber && b.Kind == teNumber:
			return teValue{Kind: teNumber, Val: a.Val + b.Val}, nil
		default:
			return teValue{}, fmt.Errorf("Cannot add %s and %s", teKindLabel(a.Kind), teKindLabel(b.Kind))
		}
	}
	// Subtraction
	switch {
	case a.Kind == teInstant && b.Kind == teDuration:
		return teValue{Kind: teInstant, Val: a.Val - b.Val}, nil
	case a.Kind == teInstant && b.Kind == teInstant:
		return teValue{Kind: teDuration, Val: a.Val - b.Val}, nil
	case a.Kind == teDuration && b.Kind == teDuration:
		return teValue{Kind: teDuration, Val: a.Val - b.Val}, nil
	case a.Kind == teNumber && b.Kind == teNumber:
		return teValue{Kind: teNumber, Val: a.Val - b.Val}, nil
	default:
		return teValue{}, fmt.Errorf("Cannot subtract %s from %s", teKindLabel(b.Kind), teKindLabel(a.Kind))
	}
}

func applyTeMulDiv(op byte, a, b teValue) (teValue, error) {
	if op == '*' {
		switch {
		case a.Kind == teNumber && b.Kind == teNumber:
			return teValue{Kind: teNumber, Val: a.Val * b.Val}, nil
		case a.Kind == teDuration && b.Kind == teNumber:
			return teValue{Kind: teDuration, Val: a.Val * b.Val}, nil
		case a.Kind == teNumber && b.Kind == teDuration:
			return teValue{Kind: teDuration, Val: a.Val * b.Val}, nil
		default:
			return teValue{}, fmt.Errorf("Cannot multiply %s and %s", teKindLabel(a.Kind), teKindLabel(b.Kind))
		}
	}
	// Division
	if b.Val == 0 {
		return teValue{}, fmt.Errorf("Cannot divide by zero")
	}
	switch {
	case a.Kind == teNumber && b.Kind == teNumber:
		return teValue{Kind: teNumber, Val: a.Val / b.Val}, nil
	case a.Kind == teDuration && b.Kind == teNumber:
		return teValue{Kind: teDuration, Val: a.Val / b.Val}, nil
	case a.Kind == teDuration && b.Kind == teDuration:
		return teValue{Kind: teNumber, Val: a.Val / b.Val}, nil
	default:
		return teValue{}, fmt.Errorf("Cannot divide %s by %s", teKindLabel(a.Kind), teKindLabel(b.Kind))
	}
}

func teKindLabel(k teValueKind) string {
	switch k {
	case teInstant:
		return "timestamp"
	case teDuration:
		return "duration"
	default:
		return "number"
	}
}

// evaluateTimeExpression evaluates a custom window bound expression to a UTC epoch-ms instant.
func evaluateTimeExpression(expr string, ctx TimeExpressionContext) TimeExpressionResult {
	trimmed := strings.TrimSpace(expr)
	if trimmed == "" {
		return TimeExpressionResult{Error: "Expression is empty"}
	}
	// Bound token allocation and recursive descent for user-supplied expressions.
	if len(trimmed) > 4096 {
		return TimeExpressionResult{Error: "Time expression exceeds 4096 bytes"}
	}
	tokens, err := tokenizeTimeExpression(trimmed, ctx)
	if err != nil {
		return TimeExpressionResult{Error: err.Error()}
	}
	p := &teParser{tokens: tokens}
	val, err := p.parseAddSub()
	if err != nil {
		return TimeExpressionResult{Error: err.Error()}
	}
	if p.peek().Kind != teTokEOF {
		return TimeExpressionResult{Error: "Unexpected trailing tokens in time expression"}
	}
	if val.Kind != teInstant {
		return TimeExpressionResult{
			Error: fmt.Sprintf("Expression resolves to a %s, not a point in time", teKindLabel(val.Kind)),
		}
	}
	if math.IsNaN(val.Val) || math.IsInf(val.Val, 0) {
		return TimeExpressionResult{Error: "Expression evaluated to a non-finite value"}
	}
	// JavaScript Date accepts instants within 100 million days of the epoch.
	if math.Abs(val.Val) > 8.64e15 {
		return TimeExpressionResult{Error: "Timestamp is outside the supported date range"}
	}
	whole := math.Floor(val.Val)
	if val.Val-whole >= 0.5 {
		whole++
	}
	ms := int64(whole)
	instant := time.UnixMilli(ms).UTC()
	iso := instant.Format("2006-01-02T15:04:05.000Z")
	if year := instant.Year(); year < 0 || year > 9999 {
		iso = fmt.Sprintf("%+07d%s", year, instant.Format("-01-02T15:04:05.000Z"))
	}
	return TimeExpressionResult{OK: true, MS: ms, ISO: iso}
}
