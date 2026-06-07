package main

import (
	"log"

	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/controlplane"
	"github.com/mcp-hub/mcp-hub/internal/db"
)

func main() {
	if err := controlplane.ListenAndServe(db.NewRuntimeStore(), config.Load(4000)); err != nil {
		log.Fatal(err)
	}
}
