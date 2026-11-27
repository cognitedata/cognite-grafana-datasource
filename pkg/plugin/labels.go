package plugin

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

const stateLabelToken = "state"

// ECMAScript whitespace and line terminators used by the frontend token grammar.
const labelSpace = `\t-\r\p{Zs}\x{2028}\x{2029}\x{FEFF}`

var (
	labelTokenRe = regexp.MustCompile(`\{\{[` + labelSpace + `]*([^{}` + labelSpace + `]+)[` + labelSpace + `]*\}\}`)
	stateTokenRe = regexp.MustCompile(`\{\{[` + labelSpace + `]*state[` + labelSpace + `]*\}\}`)
)

func labelContainsVariableProps(label string) bool {
	return label != "" && labelTokenRe.MatchString(label)
}

func labelReferencesProp(label, prop string) bool {
	for _, match := range labelTokenRe.FindAllStringSubmatch(label, -1) {
		if len(match) > 1 && strings.Split(match[1], ".")[0] == prop {
			return true
		}
	}
	return false
}

func withoutStateToken(label string) string {
	return stateTokenRe.ReplaceAllString(label, ":"+stateLabelToken)
}

func resolveLabelPath(item any, path string) (any, bool) {
	if path == "" {
		return nil, false
	}
	node := item
	for _, segment := range strings.Split(path, ".") {
		var value any
		var found bool
		switch obj := node.(type) {
		case map[string]any:
			value, found = obj[segment]
		case *orderedObj:
			value, found = obj.Values[segment]
		case []any:
			idx, err := strconv.Atoi(segment)
			if err == nil && idx >= 0 && idx < len(obj) && strconv.Itoa(idx) == segment {
				value, found = obj[idx], true
			}
		case *CogniteUnit, CogniteUnit, json.RawMessage:
			raw, err := json.Marshal(obj)
			if err != nil {
				return nil, false
			}
			decoded, err := decodeOrderedJSON(raw)
			if err != nil {
				return nil, false
			}
			value, found = resolveLabelPath(decoded, segment)
		}
		if !found {
			return nil, false
		}
		node = value
	}
	return node, true
}

func renderLabelToken(path string, value any, found bool) string {
	if !found {
		return ":" + path
	}
	if value == nil {
		if strings.Contains(path, ".") {
			return ":" + path
		}
		return "null"
	}
	switch v := value.(type) {
	case string:
		return v
	case bool:
		return strconv.FormatBool(v)
	case float64:
		if v == 0 {
			return "0"
		}
		raw, err := json.Marshal(v)
		if err == nil {
			return string(raw)
		}
		return fmt.Sprint(v)
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	case json.Number:
		if !strings.ContainsAny(v.String(), ".eE") && v.String() != "-0" {
			return v.String()
		}
		if n, err := v.Float64(); err == nil {
			return renderLabelToken(path, n, true)
		}
		return v.String()
	default:
		var b bytes.Buffer
		enc := json.NewEncoder(&b)
		enc.SetEscapeHTML(false)
		if err := enc.Encode(v); err != nil {
			return fmt.Sprint(v)
		}
		return strings.TrimSuffix(b.String(), "\n")
	}
}

func interpolateCogniteTimeSeriesInstanceLabel(labelSrc string, props map[string]any, viewPropertyNames []string) string {
	valid := make(map[string]struct{}, len(viewPropertyNames)+2)
	for _, name := range viewPropertyNames {
		valid[name] = struct{}{}
	}
	valid["space"] = struct{}{}
	valid["externalId"] = struct{}{}

	return labelTokenRe.ReplaceAllStringFunc(labelSrc, func(full string) string {
		m := labelTokenRe.FindStringSubmatch(full)
		if len(m) < 2 {
			return full
		}
		group := m[1]
		rootKey := strings.Split(group, ".")[0]
		if _, inView := valid[group]; group == stateLabelToken && !inView {
			return full
		}
		_, rootInView := valid[rootKey]
		_, rootOwnProp := props[rootKey]
		if !rootInView && !rootOwnProp {
			return renderLabelToken(group, nil, false)
		}
		val, _ := resolveLabelPath(props, group)
		return renderLabelToken(group, val, true)
	})
}
