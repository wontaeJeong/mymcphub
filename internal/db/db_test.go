package db

import (
	"context"
	"strings"
	"testing"
)

func TestSeedCatalogUsesProductionWording(t *testing.T) {
	repo := NewMemoryRepository()
	servers, err := repo.ListServers(context.Background(), nil)
	if err != nil {
		t.Fatalf("list seed servers: %v", err)
	}
	if len(servers) == 0 {
		t.Fatal("expected at least one seed server")
	}

	for _, server := range servers {
		visible := strings.ToLower(strings.Join([]string{
			server.Name,
			server.Description,
			server.StdioCommand,
			strings.Join(server.Tags, " "),
		}, " "))
		for _, marker := range []string{"예시", "sample", "mock", "dev/mock"} {
			if strings.Contains(visible, marker) {
				t.Fatalf("seed server %s contains non-production marker %q in visible catalog data: %s", server.Slug, marker, visible)
			}
		}
	}
}
