export const catalogCopy = {
  eyebrow: "운영 카탈로그",
  title: "MCP 서버 카탈로그",
  description: "조직에서 운영 중인 MCP 서버의 소유 팀, 상태, 기능 정보를 한곳에서 확인합니다.",
  summary: {
    total: "등록 서버",
    streamableHttp: "원격 HTTP",
    stdio: "로컬 실행",
    healthy: "정상 상태",
    syncFailed: "동기화 실패",
    staleSnapshots: "갱신 필요",
  },
  filters: {
    search: "서버명, 설명, 담당 팀 검색",
    transport: "연결 방식",
    liveness: "상태",
    environment: "환경",
    ownerTeam: "담당 팀",
    tag: "태그",
  },
  table: {
    server: "서버",
    transport: "연결 방식",
    status: "상태",
    owner: "담당 팀",
    environment: "환경",
    capabilities: "제공 기능",
    lastSync: "최근 동기화",
    tags: "태그",
    empty: "등록된 MCP 서버가 없습니다.",
  },
};

export const detailCopy = {
  eyebrow: "서버 상세",
  sections: {
    overview: "기본 정보",
    operations: "운영 정보",
    localMcp: "로컬 MCP 사용 정보",
    snapshot: "기능 스냅샷",
    tools: "도구",
    resources: "리소스",
    prompts: "프롬프트",
    raw: "원본 스냅샷",
  },
  emptySnapshot: "저장된 기능 스냅샷이 없습니다.",
  emptyItems: "표시할 항목이 없습니다.",
};

export const loginCopy = {
  title: "로그인",
  description: "조직 인증을 통해 MCP Hub에 접근합니다.",
};

export const themeCopy = {
  toggle: "화면 모드 전환",
  light: "라이트",
  dark: "다크",
};
