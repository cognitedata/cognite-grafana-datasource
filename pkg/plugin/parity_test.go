package plugin

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Each feature can use this helper to export its actual SDK frame to the frontend comparator.
func assertParityFrames(t *testing.T, name string, frames data.Frames) {
	t.Helper()
	raw, err := json.MarshalIndent(frames, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if dir := os.Getenv("CDF_PARITY_EXPORT_DIR"); dir != "" {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, name+".json"), raw, 0600); err != nil {
			t.Fatal(err)
		}
	}
	expected, err := os.ReadFile(filepath.Join("../../testdata/backend-parity", name+".json"))
	if err != nil {
		t.Fatal(err)
	}
	if !jsonEqualFrames(expected, raw) {
		t.Errorf("frame mismatch: %s", raw)
	}
}

func jsonEqualFrames(a, b []byte) bool {
	var x, y any
	decode := func(raw []byte, out *any) error {
		d := json.NewDecoder(bytes.NewReader(raw))
		d.UseNumber()
		return d.Decode(out)
	}
	return json.Valid(a) && json.Valid(b) && decode(a, &x) == nil && decode(b, &y) == nil && reflect.DeepEqual(x, y)
}

func TestRuntimeFrameParity(t *testing.T) {
	value := data.NewField("pressure", data.Labels{"asset": "pump"}, []float64{2.5})
	value.Config = &data.FieldConfig{Unit: "bar"}
	frame := data.NewFrame("pressure", data.NewField("Time", nil, []time.Time{time.UnixMilli(1000).UTC()}), value)
	frame.RefID = "B"
	assertParityFrames(t, "runtime-frame", data.Frames{frame})
}
