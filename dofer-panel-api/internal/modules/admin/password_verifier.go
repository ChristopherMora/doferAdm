package admin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type PasswordVerifier interface {
	Verify(ctx context.Context, email, password string) error
}

type SupabasePasswordVerifier struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewSupabasePasswordVerifier(baseURL, apiKey string) *SupabasePasswordVerifier {
	return &SupabasePasswordVerifier{
		baseURL:    strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		apiKey:     strings.TrimSpace(apiKey),
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

type supabasePasswordGrantRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type supabasePasswordGrantError struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
	Message          string `json:"msg"`
}

func (v *SupabasePasswordVerifier) Verify(ctx context.Context, email, password string) error {
	email = strings.TrimSpace(email)
	password = strings.TrimSpace(password)
	if email == "" || password == "" {
		return errors.New("email and password are required")
	}

	if v == nil || v.baseURL == "" || v.apiKey == "" {
		if allowsDevelopmentPasswordFallback(email, password) {
			return nil
		}
		return errors.New("password verification is not configured")
	}

	payload, err := json.Marshal(supabasePasswordGrantRequest{
		Email:    email,
		Password: password,
	})
	if err != nil {
		return err
	}

	requestURL := v.baseURL + "/auth/v1/token?grant_type=password"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", v.apiKey)
	req.Header.Set("Authorization", "Bearer "+v.apiKey)

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		io.Copy(io.Discard, resp.Body)
		return nil
	}

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	if resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnauthorized {
		return errors.New("invalid password")
	}

	var apiErr supabasePasswordGrantError
	_ = json.Unmarshal(body, &apiErr)
	message := apiErr.Message
	if message == "" {
		message = apiErr.ErrorDescription
	}
	if message == "" {
		message = apiErr.Error
	}
	if message == "" {
		message = strings.TrimSpace(string(body))
	}
	if message == "" {
		message = "unknown supabase error"
	}

	return fmt.Errorf("password verification failed: %s", message)
}

func allowsDevelopmentPasswordFallback(email, password string) bool {
	env := strings.ToLower(strings.TrimSpace(os.Getenv("ENVIRONMENT")))
	if env == "" {
		env = strings.ToLower(strings.TrimSpace(os.Getenv("ENV")))
	}
	if env != "development" {
		return false
	}

	allowTestToken := true
	if raw := strings.TrimSpace(os.Getenv("ALLOW_TEST_AUTH_TOKEN")); raw != "" {
		allowTestToken = strings.EqualFold(raw, "true") || raw == "1"
	}
	if !allowTestToken {
		return false
	}

	return strings.EqualFold(strings.TrimSpace(email), "test@dofer.local") &&
		(password == "test-token" || password == "test-auth-token")
}
