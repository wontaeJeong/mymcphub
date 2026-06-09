export function Badge({ value, label = value }: { value: string; label?: string }) { const cls = value === "healthy" || value === "success" ? "healthy" : value === "offline" || value === "failed" ? "offline" : value === "degraded" ? "degraded" : ""; return <span className={`badge ${cls}`}>{label}</span>; }
export function DateText({ value }: { value?: string }) { return <span>{value ? new Date(value).toLocaleString("ko-KR") : "동기화 없음"}</span>; }
export function JsonBlock({ value }: { value: unknown }) { return <pre className="json">{JSON.stringify(value, null, 2)}</pre>; }
