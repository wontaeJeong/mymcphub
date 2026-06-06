# 10. Helm 및 GitOps 배포 구성

MCP Hub를 Kubernetes에서 운영할 수 있도록 Helm chart와 GitOps overlay를 구성한다.

## 입력 전제

`00_CONTEXT.md`와 구현된 apps/packages 결과물을 기준으로 작업한다.

## 작업 목표

다음 배포 구성을 만든다.

```txt
deploy/
  helm/
    mcp-hub/
      Chart.yaml
      values.yaml
      values-dev.yaml
      values-stg.yaml
      values-prod.yaml
      templates/
  gitops/
    base/
    overlays/
      dev/
      stg/
      prod/
```

## Helm 대상 컴포넌트

- web Deployment/Service
- api Deployment/Service
- gateway Deployment/Service
- worker Deployment
- optional postgres dependency placeholder
- optional redis dependency placeholder
- ingress
- service account
- configmap
- secret template placeholder
- networkpolicy
- servicemonitor optional

## Values 구조

```yaml
image:
  registry: registry.example.com
  repositoryPrefix: mcp-hub
  tag: latest
  pullPolicy: IfNotPresent

web:
  enabled: true
  replicas: 2

api:
  enabled: true
  replicas: 2

 gateway:
  enabled: true
  replicas: 2

worker:
  enabled: true
  replicas: 1

auth:
  oidcIssuerUrl: ""
  audience: "mcp-hub"

postgres:
  external:
    enabled: true
    databaseUrlSecretName: mcp-hub-db

redis:
  external:
    enabled: true
    redisUrlSecretName: mcp-hub-redis

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: mcp-hub.example.com

networkPolicy:
  enabled: true

runtime:
  readOnlyRootFilesystem: true
  runAsNonRoot: true
```

주의: YAML indentation 오류가 없게 검증한다.

## Kubernetes 보안 요구사항

- runAsNonRoot
- readOnlyRootFilesystem 가능한 컴포넌트 적용
- resource requests/limits
- liveness/readiness probes
- NetworkPolicy
- ServiceAccount 분리 가능 구조
- secrets는 values에 평문으로 넣지 않음

## GitOps 요구사항

Argo CD 또는 Flux에서 사용할 수 있는 overlay 예시를 만든다.

```txt
gitops/base/kustomization.yaml
gitops/overlays/dev/kustomization.yaml
gitops/overlays/stg/kustomization.yaml
gitops/overlays/prod/kustomization.yaml
```

Helm chart를 참조하는 형태로 구성한다.

## 완료 조건

- `helm template` 성공
- dev/stg/prod values 렌더링 가능
- NetworkPolicy 포함
- Ingress 포함
- README에 설치/업그레이드/롤백 방법 포함
- docs/DEPLOYMENT.md 작성
