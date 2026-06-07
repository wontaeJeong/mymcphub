package main

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/mcp-hub/mcp-hub/internal/mcp"
)

type repo struct {
	Owner       string `json:"owner"`
	Name        string `json:"name"`
	Visibility  string `json:"visibility"`
	DefaultRef  string `json:"defaultRef"`
	OpenPRCount int    `json:"openPrCount"`
}

var githubRepos = []repo{{Owner: "platform", Name: "mcp-hub", Visibility: "private", DefaultRef: "main", OpenPRCount: 2}, {Owner: "platform", Name: "mcp-runtime-adapter", Visibility: "private", DefaultRef: "main", OpenPRCount: 1}}

func main() {
	port := 5111
	if value := os.Getenv("PORT"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			port = parsed
		}
	}
	log.Fatal(http.ListenAndServe(":"+strconv.Itoa(port), server().Handler()))
}

func server() mcp.SimpleServer {
	return mcp.SimpleServer{Name: "github-readonly", Version: "0.1.0", Tools: []mcp.ToolDefinition{
		{Name: "list_repositories", Description: "List approved GitHub repositories visible to the bound provider token.", InputSchema: mcp.ObjectSchema(nil, nil), ReadOnly: true, PolicyTags: []string{"git-provider", "github", "readonly"}, Call: func(_ map[string]interface{}) (map[string]interface{}, error) {
			return mcp.TextJSON(map[string]interface{}{"repositories": githubRepos, "tokenConfigured": os.Getenv("GITHUB_TOKEN") != ""}), nil
		}},
		{Name: "get_pull_request", Description: "Read pull request summary metadata for an approved GitHub repository.", InputSchema: mcp.ObjectSchema(map[string]interface{}{"repository": map[string]interface{}{"type": "string"}, "number": map[string]interface{}{"type": "integer"}}, []interface{}{"repository", "number"}), ReadOnly: true, PolicyTags: []string{"git-provider", "github", "readonly", "pull-requests"}, Call: func(args map[string]interface{}) (map[string]interface{}, error) {
			repository, _ := args["repository"].(string)
			if !knownRepo(repository) {
				return nil, mcp.InputError("Repository is outside the approved provider scope")
			}
			return mcp.TextJSON(map[string]interface{}{"repository": repository, "number": args["number"], "title": "Runtime manifest review", "state": "open", "author": "platform-engineer"}), nil
		}},
		{Name: "search_issues", Description: "Search issue titles in approved GitHub repositories without returning secret-bearing fields.", InputSchema: mcp.ObjectSchema(map[string]interface{}{"query": map[string]interface{}{"type": "string"}}, []interface{}{"query"}), ReadOnly: true, PolicyTags: []string{"git-provider", "github", "readonly", "issues"}, Call: func(args map[string]interface{}) (map[string]interface{}, error) {
			query, _ := args["query"].(string)
			return mcp.TextJSON(map[string]interface{}{"query": query, "items": []map[string]interface{}{{"repository": "platform/mcp-hub", "number": 42, "title": "Document runtime sandbox profile", "state": "open"}}}), nil
		}},
	}}
}

func knownRepo(repository string) bool {
	for _, item := range githubRepos {
		if strings.EqualFold(repository, item.Owner+"/"+item.Name) {
			return true
		}
	}
	return false
}
