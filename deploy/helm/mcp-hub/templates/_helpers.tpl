{{- define "mcp-hub.name" -}}mcp-hub{{- end -}}
{{- define "mcp-hub.fullname" -}}{{ .Release.Name }}{{- end -}}
{{- define "mcp-hub.labels" -}}
app.kubernetes.io/name: {{ include "mcp-hub.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
{{- end -}}
{{- define "mcp-hub.image" -}}
{{- $root := index . 0 -}}{{- $component := index . 1 -}}{{- $img := index $root.Values $component "image" -}}
{{- printf "%s/%s/%s:%s" $root.Values.image.registry $root.Values.image.repositoryPrefix $img.repository $root.Values.image.tag -}}
{{- end -}}
