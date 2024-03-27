//go:build mage
// +build mage

package main

import (
	// mage:import
	build "github.com/grafana/grafana-plugin-sdk-go/build"
)

// Default configures the default target.
var Default = build.BuildAll

// // Test runs the test suite.
// func Test() error {
// 	return sh.RunV("go", "test", "./...")
// }
