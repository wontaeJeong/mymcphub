package main

import (
	"log"

	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/gateway"
)

func main() {
	if err := gateway.ListenAndServe(db.NewRuntimeStore(), config.Load(5000)); err != nil {
		log.Fatal(err)
	}
}
