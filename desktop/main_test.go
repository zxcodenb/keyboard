package main

import (
	"bufio"
	"encoding/json"
	"os"
	"os/exec"
	"testing"
)

func TestBridgeHelper(t *testing.T) {
	if os.Getenv("LIGHT_STUDIO_TEST_HELPER") != "1" {
		return
	}
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		var request map[string]json.RawMessage
		json.Unmarshal(scanner.Bytes(), &request)
		if string(request["action"]) == `"apply"` {
			var settings Settings
			json.Unmarshal(request["settings"], &settings)
			json.NewEncoder(os.Stdout).Encode(map[string]any{"data": Snapshot{Settings: settings, Controlled: true}})
		} else {
			json.NewEncoder(os.Stdout).Encode(map[string]string{"error": "测试错误"})
		}
	}
	os.Exit(0)
}

func TestBridgeRoundTripAndError(t *testing.T) {
	cmd := exec.Command(os.Args[0], "-test.run=TestBridgeHelper")
	cmd.Env = append(os.Environ(), "LIGHT_STUDIO_TEST_HELPER=1")
	input, err := cmd.StdinPipe()
	if err != nil {
		t.Fatal(err)
	}
	output, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	k := &Keyboard{cmd: cmd, input: input, output: bufio.NewScanner(output)}
	defer k.stop()
	settings := Settings{Mode: "solid", Color: "#aabbcc", Brightness: 42, Power: true, Overrides: map[string]string{"112": "#ff0000"}}
	result, err := k.Apply(settings)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Controlled || result.Settings.Overrides["112"] != "#ff0000" || result.Settings.Brightness != 42 {
		t.Fatalf("控制桥往返数据不一致：%+v", result)
	}
	if _, err := k.Snapshot(); err == nil || err.Error() != "测试错误" {
		t.Fatalf("控制桥未返回错误：%v", err)
	}
}
