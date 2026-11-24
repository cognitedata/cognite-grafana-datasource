package cdf

import (
	"bytes"
	"compress/gzip"
	"errors"
	"io"
	"net/http"
	"strings"
)

const gzipRequestThreshold = 1024

// Small bodies cost more to compress than they save. Encode once so retries
// replay identical bytes, and keep JSON as the request media type.
func compressRequest(payload []byte) ([]byte, bool, error) {
	if len(payload) < gzipRequestThreshold {
		return payload, false, nil
	}
	var buffer bytes.Buffer
	writer := gzip.NewWriter(&buffer)
	if _, err := writer.Write(payload); err != nil {
		return nil, false, err
	}
	if err := writer.Close(); err != nil {
		return nil, false, err
	}
	if buffer.Len() >= len(payload) {
		return payload, false, nil
	}
	return buffer.Bytes(), true, nil
}

// Bound both wire and decompressed bytes. Setting Accept-Encoding explicitly
// makes this work with Grafana/custom transports even if auto decoding is off.
func readResponse(res *http.Response, limit int64) ([]byte, error) {
	defer res.Body.Close()
	wire := &io.LimitedReader{R: res.Body, N: limit + 1}
	var reader io.Reader = wire
	encoding := strings.ToLower(strings.TrimSpace(res.Header.Get("Content-Encoding")))
	if !res.Uncompressed && encoding != "" && encoding != "identity" {
		if encoding != "gzip" {
			return nil, errors.New("Unsupported CDF response content encoding")
		}
		decoded, err := gzip.NewReader(wire)
		if err != nil {
			return nil, errors.New("Invalid gzip response")
		}
		defer decoded.Close()
		reader = decoded
	}
	data, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, errors.New("Could not decode CDF response")
	}
	if int64(len(data)) > limit || wire.N <= 0 {
		return nil, errors.New("CDF response exceeds the size limit; narrow the query")
	}
	return data, nil
}
