package plugin

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
)

type orderedObj struct {
	Keys   []string
	Values map[string]any
}

func decodeOrderedJSON(raw []byte) (any, error) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	val, err := decodeOrderedTokenValue(dec)
	if err != nil {
		return nil, err
	}
	if _, err := dec.Token(); err != io.EOF {
		return nil, fmt.Errorf("unexpected trailing JSON")
	}
	return val, nil
}

func decodeOrderedTokenValue(dec *json.Decoder) (any, error) {
	tok, err := dec.Token()
	if err != nil {
		return nil, err
	}
	return decodeOrderedFromToken(dec, tok)
}

func decodeOrderedFromToken(dec *json.Decoder, tok json.Token) (any, error) {
	switch t := tok.(type) {
	case json.Delim:
		switch t {
		case '{':
			obj := &orderedObj{Values: make(map[string]any)}
			for dec.More() {
				kTok, err := dec.Token()
				if err != nil {
					return nil, err
				}
				k, ok := kTok.(string)
				if !ok {
					return nil, fmt.Errorf("expected string JSON key, got %T", kTok)
				}
				v, err := decodeOrderedTokenValue(dec)
				if err != nil {
					return nil, err
				}
				if _, exists := obj.Values[k]; !exists {
					obj.Keys = append(obj.Keys, k)
				}
				obj.Values[k] = v
			}
			// Consume closing '}'
			if _, err := dec.Token(); err != nil {
				return nil, err
			}
			return obj, nil
		case '[':
			arr := []any{}
			for dec.More() {
				v, err := decodeOrderedTokenValue(dec)
				if err != nil {
					return nil, err
				}
				arr = append(arr, v)
			}
			// Consume closing ']'
			if _, err := dec.Token(); err != nil {
				return nil, err
			}
			return arr, nil
		default:
			return nil, fmt.Errorf("unexpected JSON delimiter %q", t)
		}
	default:
		return t, nil
	}
}

func orderedToPlainMap(v any) any {
	switch tv := v.(type) {
	case *orderedObj:
		if tv == nil {
			return nil
		}
		m := make(map[string]any, len(tv.Keys))
		for _, k := range tv.Keys {
			m[k] = orderedToPlainMap(tv.Values[k])
		}
		return m
	case []any:
		out := make([]any, len(tv))
		for i, elem := range tv {
			out[i] = orderedToPlainMap(elem)
		}
		return out
	default:
		return v
	}
}
