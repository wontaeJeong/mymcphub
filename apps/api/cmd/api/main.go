package main

import (
	"context"
	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/controlplane"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"log"
)

func main() {
	cfg := config.Load(4000)
	repo, err := db.OpenRepository(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Printf("%v; falling back to in-memory repository", err)
		repo = db.NewMemoryRepository()
	}
	if err := controlplane.ListenAndServe(repo, cfg); err != nil {
		log.Fatal(err)
	}
}
