package main

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/mcp-hub/mcp-hub/internal/mcp"
)

type project struct {
	Path        string `json:"path"`
	Visibility  string `json:"visibility"`
	DefaultRef  string `json:"defaultRef"`
	OpenMRCount int    `json:"openMrCount"`
}

var gitlabProjects = []project{{Path: "platform/mcp-hub", Visibility: "private", DefaultRef: "main", OpenMRCount: 1}, {Path: "platform/runtime-policy", Visibility: "private", DefaultRef: "main", OpenMRCount: 0}}

func main() {
	port := 5112
	if value := os.Getenv("PORT"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			port = parsed
		}
	}
	log.Fatal(http.ListenAndServe(":"+strconv.Itoa(port), server().Handler()))
}

func server() mcp.SimpleServer {
	return mcp.SimpleServer{Name: "gitlab-readonly", Version: "0.1.0", Tools: []mcp.ToolDefinition{
		{Name: "list_projects", Description: "List approved GitLab projects visible to the bound provider token.", InputSchema: mcp.ObjectSchema(nil, nil), ReadOnly: true, PolicyTags: []string{"git-provider", "gitlab", "readonly"}, Call: func(_ map[string]interface{}) (map[string]interface{}, error) {
			return mcp.TextJSON(map[string]interface{}{"projects": gitlabProjects, "tokenConfigured": os.Getenv("GITLAB_TOKEN") != ""}), nil
		}},
		{Name: "get_merge_request", Description: "Read merge request summary metadata for an approved GitLab project.", InputSchema: mcp.ObjectSchema(map[string]interface{}{"project": map[string]interface{}{"type": "string"}, "iid": map[string]interface{}{"type": "integer"}}, []interface{}{"project", "iid"}), ReadOnly: true, PolicyTags: []string{"git-provider", "gitlab", "readonly", "merge-requests"}, Call: func(args map[string]interface{}) (map[string]interface{}, error) {
			projectPath, _ := args["project"].(string)
			if !knownProject(projectPath) {
				return nil, mcp.InputError("Project is outside the approved provider scope")
			}
			return mcp.TextJSON(map[string]interface{}{"project": projectPath, "iid": args["iid"], "title": "Runtime egress policy update", "state": "opened", "author": "platform-engineer"}), nil
		}},
	}}
}

func knownProject(projectPath string) bool {
	for _, item := range gitlabProjects {
		if strings.EqualFold(projectPath, item.Path) {
			return true
		}
	}
	return false
}
