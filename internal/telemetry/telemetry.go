package telemetry

func Span(_ string, fn func()) { fn() }
