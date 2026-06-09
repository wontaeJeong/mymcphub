# Web UI/UX OpenCode Prompts

Original task: 전체 Web UI를 샅샅히 살펴보고 UI/UX 개선점을 모두 파악한 뒤, 수정 작업을 순차적인 OpenCode용 작업 프롬프트 여러 개로 작성한다. 한글 Web 페이지에 맞는 폰트/UI, 과도한 정보 노출, 과도한 설정 기능, 폰트 크기/위치/배치를 포함한다.

Covered route surfaces: `/`, `/login`, `/forbidden`, `/user`, `/user/catalog`, `/user/access`, `/user/client-config`, `/user/servers/[serverId]`, `/admin`, `/admin/servers`, `/admin/servers/[serverId]`, `/admin/approvals`, `/admin/audit`, `/admin/operations`, `/admin/emergency`, plus flat redirects `/catalog`, `/access`, `/client-config`, `/approvals`, `/audit`, `/operations`, `/tools`, `/servers/[serverId]`.

Use these prompts sequentially. Each prompt intentionally limits scope so OpenCode can implement, verify, and manually QA one UI/UX improvement wave at a time.

