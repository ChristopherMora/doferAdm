package infra

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"
)

// SupabaseAdminClient crea usuarios de Supabase Auth vía la Admin API
// (POST /auth/v1/admin/users), usando el service_role key. Es el único
// consumidor real de SupabaseServiceRoleKey en el backend hoy.
type SupabaseAdminClient struct {
	baseURL    string
	serviceKey string
	httpClient *http.Client
}

func NewSupabaseAdminClient(baseURL, serviceKey string) *SupabaseAdminClient {
	return &SupabaseAdminClient{
		baseURL:    strings.TrimRight(baseURL, "/"),
		serviceKey: serviceKey,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

type createUserRequest struct {
	Email        string                 `json:"email"`
	Password     string                 `json:"password"`
	EmailConfirm bool                   `json:"email_confirm"`
	AppMetadata  map[string]interface{} `json:"app_metadata"`
}

type updateUserRequest struct {
	Email        string `json:"email,omitempty"`
	Password     string `json:"password,omitempty"`
	EmailConfirm *bool  `json:"email_confirm,omitempty"`
}

type createUserResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type supabaseErrorResponse struct {
	Message string `json:"msg"`
	Error   string `json:"error_description"`
}

// CreateAuthUser crea el usuario de auth con app_metadata.role=affiliate
// y devuelve su UUID + la contraseña temporal generada (el admin debe
// comunicarla al afiliado; no se envía email automático en esta versión).
// Implementa la interfaz domain.AuthUserProvisioner.
func (c *SupabaseAdminClient) CreateAuthUser(email string) (userID string, temporaryPassword string, err error) {
	if c.baseURL == "" || c.serviceKey == "" {
		return "", "", fmt.Errorf("supabase admin client not configured: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
	}

	temporaryPassword, err = generateTemporaryPassword()
	if err != nil {
		return "", "", err
	}

	reqBody := createUserRequest{
		Email:        email,
		Password:     temporaryPassword,
		EmailConfirm: true,
		AppMetadata:  map[string]interface{}{"role": "affiliate"},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", "", err
	}

	url := c.baseURL + "/auth/v1/admin/users"
	httpReq, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("apikey", c.serviceKey)
	httpReq.Header.Set("Authorization", "Bearer "+c.serviceKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr supabaseErrorResponse
		_ = json.Unmarshal(respBody, &apiErr)
		message := apiErr.Message
		if message == "" {
			message = apiErr.Error
		}
		if message == "" {
			message = strings.TrimSpace(string(respBody))
		}
		return "", "", fmt.Errorf("supabase admin api error (status %d): %s", resp.StatusCode, message)
	}

	var created createUserResponse
	if err := json.Unmarshal(respBody, &created); err != nil {
		return "", "", err
	}
	if created.ID == "" {
		return "", "", fmt.Errorf("supabase admin api: respuesta sin id de usuario")
	}

	return created.ID, temporaryPassword, nil
}

func (c *SupabaseAdminClient) UpdateAuthUserEmail(userID, email string) error {
	confirmed := true
	return c.updateAuthUser(userID, updateUserRequest{
		Email:        email,
		EmailConfirm: &confirmed,
	})
}

func (c *SupabaseAdminClient) ResetAuthUserPassword(userID string) (string, error) {
	temporaryPassword, err := generateTemporaryPassword()
	if err != nil {
		return "", err
	}
	if err := c.updateAuthUser(userID, updateUserRequest{Password: temporaryPassword}); err != nil {
		return "", err
	}
	return temporaryPassword, nil
}

func (c *SupabaseAdminClient) DeleteAuthUser(userID string) error {
	if c.baseURL == "" || c.serviceKey == "" {
		return fmt.Errorf("supabase admin client not configured: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return fmt.Errorf("auth user id is required")
	}

	url := c.baseURL + "/auth/v1/admin/users/" + userID
	httpReq, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return err
	}
	httpReq.Header.Set("apikey", c.serviceKey)
	httpReq.Header.Set("Authorization", "Bearer "+c.serviceKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode == http.StatusNotFound {
		return nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr supabaseErrorResponse
		_ = json.Unmarshal(respBody, &apiErr)
		message := apiErr.Message
		if message == "" {
			message = apiErr.Error
		}
		if message == "" {
			message = strings.TrimSpace(string(respBody))
		}
		return fmt.Errorf("supabase admin api error (status %d): %s", resp.StatusCode, message)
	}

	return nil
}

func (c *SupabaseAdminClient) updateAuthUser(userID string, payload updateUserRequest) error {
	if c.baseURL == "" || c.serviceKey == "" {
		return fmt.Errorf("supabase admin client not configured: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return fmt.Errorf("auth user id is required")
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := c.baseURL + "/auth/v1/admin/users/" + userID
	httpReq, err := http.NewRequest(http.MethodPatch, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("apikey", c.serviceKey)
	httpReq.Header.Set("Authorization", "Bearer "+c.serviceKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr supabaseErrorResponse
		_ = json.Unmarshal(respBody, &apiErr)
		message := apiErr.Message
		if message == "" {
			message = apiErr.Error
		}
		if message == "" {
			message = strings.TrimSpace(string(respBody))
		}
		return fmt.Errorf("supabase admin api error (status %d): %s", resp.StatusCode, message)
	}

	return nil
}

const tempPasswordChars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%"

// generateTemporaryPassword genera una contraseña aleatoria de 16 caracteres
// que el admin comparte manualmente con el afiliado para su primer login.
func generateTemporaryPassword() (string, error) {
	const length = 16
	result := make([]byte, length)
	max := big.NewInt(int64(len(tempPasswordChars)))

	for i := range result {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		result[i] = tempPasswordChars[n.Int64()]
	}

	return string(result), nil
}
