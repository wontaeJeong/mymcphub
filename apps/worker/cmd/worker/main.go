package main

import (
	"context"
	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/worker"
	"log"
)

func main() {
	cfg := config.Load(4100)
	repo, err := db.OpenRepository(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Printf("%v; falling back to in-memory repository", err)
		repo = db.NewMemoryRepository()
	}
	if err := worker.ListenAndServe(repo, cfg); err != nil {
		log.Fatal(err)
	}
}
