{{- define "mcp-hub.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "mcp-hub.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "mcp-hub.labels" -}}
app.kubernetes.io/name: {{ include "mcp-hub.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "mcp-hub.selectorLabels" -}}
app.kubernetes.io/name: {{ include "mcp-hub.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "mcp-hub.componentName" -}}
{{- printf "%s-%s" (include "mcp-hub.fullname" .root) .component | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "mcp-hub.componentLabels" -}}
{{ include "mcp-hub.labels" .root }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "mcp-hub.componentSelectorLabels" -}}
{{ include "mcp-hub.selectorLabels" .root }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "mcp-hub.image" -}}
{{- $root := .root -}}
{{- $componentValues := .componentValues -}}
{{- $repository := printf "%s/%s/%s" $root.Values.image.registry $root.Values.image.repositoryPrefix $componentValues.image.repository -}}
{{- $digest := default "" $componentValues.image.digest -}}
{{- if $digest -}}
{{- printf "%s@%s" $repository $digest -}}
{{- else -}}
{{- printf "%s:%s" $repository $root.Values.image.tag -}}
{{- end -}}
{{- end -}}

{{- define "mcp-hub.serviceAccountName" -}}
{{- $root := .root -}}
{{- $component := .component -}}
{{- $componentValues := .componentValues -}}
{{- if $componentValues.serviceAccountName -}}
{{- $componentValues.serviceAccountName -}}
{{- else if $root.Values.serviceAccount.create -}}
{{- printf "%s-%s" (include "mcp-hub.fullname" $root) $component | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- "default" -}}
{{- end -}}
{{- end -}}

{{- define "mcp-hub.podSecurityContext" -}}
runAsNonRoot: {{ .Values.runtime.runAsNonRoot }}
runAsUser: {{ .Values.runtime.runAsUser }}
runAsGroup: {{ .Values.runtime.runAsGroup }}
fsGroup: {{ .Values.runtime.fsGroup }}
seccompProfile:
{{ toYaml .Values.runtime.seccompProfile | indent 2 }}
{{- end -}}

{{- define "mcp-hub.containerSecurityContext" -}}
readOnlyRootFilesystem: {{ .Values.runtime.readOnlyRootFilesystem }}
allowPrivilegeEscalation: {{ .Values.runtime.allowPrivilegeEscalation }}
capabilities:
{{ toYaml .Values.runtime.capabilities | indent 2 }}
{{- end -}}

{{- define "mcp-hub.commonEnvFrom" -}}
- configMapRef:
    name: {{ include "mcp-hub.fullname" . }}-config
{{- end -}}

{{- define "mcp-hub.secretEnv" -}}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ .Values.postgres.external.databaseUrlSecretName }}
      key: {{ .Values.postgres.external.databaseUrlSecretKey }}
- name: REDIS_URL
  valueFrom:
    secretKeyRef:
      name: {{ .Values.redis.external.redisUrlSecretName }}
      key: {{ .Values.redis.external.redisUrlSecretKey }}
- name: OIDC_CLIENT_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ .Values.auth.oidcClientSecret.secretName }}
      key: {{ .Values.auth.oidcClientSecret.secretKey }}
- name: MCP_TRUSTED_PROXY_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ .Values.auth.trustedProxy.secretName }}
      key: {{ .Values.auth.trustedProxy.secretKey }}
{{- end -}}

{{- define "mcp-hub.httpProbe" -}}
httpGet:
  path: {{ .path }}
  port: http
initialDelaySeconds: {{ .initialDelaySeconds }}
periodSeconds: {{ .periodSeconds }}
{{- end -}}

{{- define "mcp-hub.tcpProbe" -}}
tcpSocket:
  port: http
initialDelaySeconds: {{ .initialDelaySeconds }}
periodSeconds: {{ .periodSeconds }}
{{- end -}}
