package main

import (
	"log"

	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/worker"
)

func main() {
	if err := worker.ListenAndServe(db.NewRuntimeStore(), config.Load(4100)); err != nil {
		log.Fatal(err)
	}
}
