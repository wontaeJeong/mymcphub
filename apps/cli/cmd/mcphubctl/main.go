package main

import (
	"os"

	"github.com/mcp-hub/mcp-hub/internal/cli"
)

func main() { os.Exit(cli.Main(os.Args[1:])) }
