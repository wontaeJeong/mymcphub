package httpx

import (
	"encoding/json"
	"net/http"
)

type ErrorEnvelope struct {
	Error   ErrorBody `json:"error"`
	TraceID string    `json:"traceId"`
}
type ErrorBody struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details"`
}

func WriteJSON(w http.ResponseWriter, status int, value interface{}) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func WriteText(w http.ResponseWriter, status int, contentType string, value string) {
	w.Header().Set("content-type", contentType)
	w.WriteHeader(status)
	_, _ = w.Write([]byte(value))
}

func WriteError(w http.ResponseWriter, status int, code, message, traceID string, details map[string]interface{}) {
	if details == nil {
		details = map[string]interface{}{}
	}
	WriteJSON(w, status, ErrorEnvelope{Error: ErrorBody{Code: code, Message: message, Details: details}, TraceID: traceID})
}

func DecodeJSON(r *http.Request, target interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(target)
}
