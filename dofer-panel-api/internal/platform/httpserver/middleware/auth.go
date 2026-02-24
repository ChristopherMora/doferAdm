package middleware

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserIDKey contextKey = "user_id"
const UserRoleKey contextKey = "user_role"

const (
	testAuthUserID         = "11111111-1111-1111-1111-111111111111"
	testAuthUserRole       = "admin"
	defaultJWKSCacheTTL    = 60 * time.Minute
	defaultJWKSHTTPTimeout = 5 * time.Second
	jwtValidationModeHS256 = "hs256"
	jwtValidationModeJWKS  = "jwks"
)

type runtimeAuthConfig struct {
	validationMode     string
	jwtSecret          string
	supabaseURL        string
	jwksURL            string
	jwksCacheTTL       time.Duration
	allowTestAuthToken bool
}

type appMetadataClaims struct {
	Role string `json:"role,omitempty"`
}

type userClaims struct {
	jwt.RegisteredClaims
	Role        string            `json:"role,omitempty"`
	AppMetadata appMetadataClaims `json:"app_metadata,omitempty"`
}

type jwksDocument struct {
	Keys []jwkKey `json:"keys"`
}

type jwkKey struct {
	Kty string `json:"kty"`
	Use string `json:"use,omitempty"`
	Kid string `json:"kid"`
	Alg string `json:"alg,omitempty"`
	Crv string `json:"crv,omitempty"`
	X   string `json:"x,omitempty"`
	Y   string `json:"y,omitempty"`
	N   string `json:"n,omitempty"`
	E   string `json:"e,omitempty"`
}

var (
	authConfigOnce sync.Once
	authConfig     runtimeAuthConfig

	jwksCache = struct {
		mu        sync.RWMutex
		keys      map[string]interface{}
		expiresAt time.Time
	}{
		keys: make(map[string]interface{}),
	}
	jwksRefreshMu sync.Mutex
)

func loadRuntimeAuthConfig() runtimeAuthConfig {
	authConfigOnce.Do(func() {
		env := strings.ToLower(strings.TrimSpace(os.Getenv("ENVIRONMENT")))
		if env == "" {
			env = strings.ToLower(strings.TrimSpace(os.Getenv("ENV")))
		}

		allowTestAuthToken := env == "development"
		if raw := strings.TrimSpace(os.Getenv("ALLOW_TEST_AUTH_TOKEN")); raw != "" {
			allowTestAuthToken = parseBool(raw)
		}

		supabaseURL := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
		validationMode := strings.ToLower(strings.TrimSpace(os.Getenv("JWT_VALIDATION_MODE")))
		if validationMode == "" {
			if supabaseURL != "" {
				validationMode = jwtValidationModeJWKS
			} else {
				validationMode = jwtValidationModeHS256
			}
		}

		jwksURL := strings.TrimSpace(os.Getenv("SUPABASE_JWKS_URL"))
		if jwksURL == "" && supabaseURL != "" {
			jwksURL = strings.TrimRight(supabaseURL, "/") + "/auth/v1/.well-known/jwks.json"
		}

		jwksCacheTTL := defaultJWKSCacheTTL
		if raw := strings.TrimSpace(os.Getenv("JWT_JWKS_CACHE_TTL_SECONDS")); raw != "" {
			ttlSeconds, err := time.ParseDuration(raw + "s")
			if err == nil && ttlSeconds > 0 {
				jwksCacheTTL = ttlSeconds
			}
		}

		authConfig = runtimeAuthConfig{
			validationMode:     validationMode,
			jwtSecret:          strings.TrimSpace(os.Getenv("JWT_SECRET")),
			supabaseURL:        supabaseURL,
			jwksURL:            jwksURL,
			jwksCacheTTL:       jwksCacheTTL,
			allowTestAuthToken: allowTestAuthToken,
		}
	})

	return authConfig
}

func parseBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "t", "yes", "y", "on":
		return true
	default:
		return false
	}
}

func extractBearerToken(authHeader string) (string, error) {
	parts := strings.Fields(authHeader)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", errors.New("invalid authorization header format")
	}

	return strings.TrimSpace(parts[1]), nil
}

func isTestToken(token string) bool {
	return token == "test-token" || token == "test-auth-token"
}

func parseAndValidateClaims(token string, cfg runtimeAuthConfig) (*userClaims, error) {
	claims := &userClaims{}
	parsedToken, err := jwt.ParseWithClaims(
		token,
		claims,
		func(t *jwt.Token) (interface{}, error) {
			switch cfg.validationMode {
			case jwtValidationModeHS256:
				if t.Method == nil || t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
					return nil, errors.New("unexpected signing method")
				}
				if cfg.jwtSecret == "" {
					return nil, errors.New("jwt secret is not configured")
				}
				return []byte(cfg.jwtSecret), nil
			case jwtValidationModeJWKS:
				return resolveJWKSKey(t, cfg)
			default:
				return nil, fmt.Errorf("unsupported JWT validation mode: %s", cfg.validationMode)
			}
		},
		jwt.WithLeeway(30*time.Second),
	)
	if err != nil {
		return nil, err
	}
	if !parsedToken.Valid {
		return nil, errors.New("invalid token")
	}

	if cfg.validationMode == jwtValidationModeJWKS {
		if err := validateJWKSClaims(claims, cfg); err != nil {
			return nil, err
		}
	}

	return claims, nil
}

func resolveJWKSKey(token *jwt.Token, cfg runtimeAuthConfig) (interface{}, error) {
	if token.Method == nil {
		return nil, errors.New("missing signing method")
	}

	kid, _ := token.Header["kid"].(string)
	kid = strings.TrimSpace(kid)
	if kid == "" {
		return nil, errors.New("missing kid header")
	}

	key, err := getJWKPublicKey(cfg, kid)
	if err != nil {
		return nil, err
	}

	switch token.Method.(type) {
	case *jwt.SigningMethodECDSA:
		if _, ok := key.(*ecdsa.PublicKey); !ok {
			return nil, errors.New("token requires ECDSA key")
		}
	case *jwt.SigningMethodRSA:
		if _, ok := key.(*rsa.PublicKey); !ok {
			return nil, errors.New("token requires RSA key")
		}
	default:
		return nil, fmt.Errorf("unsupported signing method: %s", token.Method.Alg())
	}

	return key, nil
}

func getJWKPublicKey(cfg runtimeAuthConfig, kid string) (interface{}, error) {
	now := time.Now()
	if key, ok := lookupCachedJWK(kid, now); ok {
		return key, nil
	}

	if err := refreshJWKSCache(cfg); err != nil {
		// Si falla el refresh pero había una key en caché (aunque vencida), usarla como fallback.
		if key, ok := lookupAnyCachedJWK(kid); ok {
			return key, nil
		}
		return nil, err
	}

	if key, ok := lookupCachedJWK(kid, time.Now()); ok {
		return key, nil
	}

	return nil, fmt.Errorf("signing key not found for kid %s", kid)
}

func lookupCachedJWK(kid string, now time.Time) (interface{}, bool) {
	jwksCache.mu.RLock()
	defer jwksCache.mu.RUnlock()

	if now.After(jwksCache.expiresAt) {
		return nil, false
	}

	key, ok := jwksCache.keys[kid]
	return key, ok
}

func lookupAnyCachedJWK(kid string) (interface{}, bool) {
	jwksCache.mu.RLock()
	defer jwksCache.mu.RUnlock()

	key, ok := jwksCache.keys[kid]
	return key, ok
}

func refreshJWKSCache(cfg runtimeAuthConfig) error {
	if strings.TrimSpace(cfg.jwksURL) == "" {
		return errors.New("SUPABASE_JWKS_URL or SUPABASE_URL is required in jwks mode")
	}

	jwksRefreshMu.Lock()
	defer jwksRefreshMu.Unlock()

	keys, err := fetchJWKSKeys(cfg.jwksURL)
	if err != nil {
		return err
	}
	if len(keys) == 0 {
		return errors.New("jwks returned no usable keys")
	}

	expiresAt := time.Now().Add(cfg.jwksCacheTTL)
	if cfg.jwksCacheTTL <= 0 {
		expiresAt = time.Now().Add(defaultJWKSCacheTTL)
	}

	jwksCache.mu.Lock()
	jwksCache.keys = keys
	jwksCache.expiresAt = expiresAt
	jwksCache.mu.Unlock()

	return nil
}

func fetchJWKSKeys(jwksURL string) (map[string]interface{}, error) {
	client := &http.Client{Timeout: defaultJWKSHTTPTimeout}
	req, err := http.NewRequest(http.MethodGet, jwksURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("jwks request failed: status %d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var doc jwksDocument
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, err
	}

	keys := make(map[string]interface{}, len(doc.Keys))
	for _, key := range doc.Keys {
		kid := strings.TrimSpace(key.Kid)
		if kid == "" {
			continue
		}

		publicKey, err := jwkToPublicKey(key)
		if err != nil {
			continue
		}
		keys[kid] = publicKey
	}

	return keys, nil
}

func jwkToPublicKey(jwk jwkKey) (interface{}, error) {
	switch strings.ToUpper(strings.TrimSpace(jwk.Kty)) {
	case "EC":
		return parseECPublicKey(jwk)
	case "RSA":
		return parseRSAPublicKey(jwk)
	default:
		return nil, fmt.Errorf("unsupported jwk type: %s", jwk.Kty)
	}
}

func parseECPublicKey(jwk jwkKey) (*ecdsa.PublicKey, error) {
	var curve elliptic.Curve
	switch strings.TrimSpace(jwk.Crv) {
	case "P-256":
		curve = elliptic.P256()
	case "P-384":
		curve = elliptic.P384()
	case "P-521":
		curve = elliptic.P521()
	default:
		return nil, fmt.Errorf("unsupported EC curve: %s", jwk.Crv)
	}

	xBytes, err := decodeBase64URL(jwk.X)
	if err != nil {
		return nil, err
	}
	yBytes, err := decodeBase64URL(jwk.Y)
	if err != nil {
		return nil, err
	}

	x := new(big.Int).SetBytes(xBytes)
	y := new(big.Int).SetBytes(yBytes)
	if !curve.IsOnCurve(x, y) {
		return nil, errors.New("invalid EC public key point")
	}

	return &ecdsa.PublicKey{
		Curve: curve,
		X:     x,
		Y:     y,
	}, nil
}

func parseRSAPublicKey(jwk jwkKey) (*rsa.PublicKey, error) {
	nBytes, err := decodeBase64URL(jwk.N)
	if err != nil {
		return nil, err
	}
	eBytes, err := decodeBase64URL(jwk.E)
	if err != nil {
		return nil, err
	}

	n := new(big.Int).SetBytes(nBytes)
	if n.Sign() <= 0 {
		return nil, errors.New("invalid rsa modulus")
	}

	e := 0
	for _, b := range eBytes {
		e = (e << 8) + int(b)
	}
	if e <= 1 {
		return nil, errors.New("invalid rsa exponent")
	}

	return &rsa.PublicKey{
		N: n,
		E: e,
	}, nil
}

func decodeBase64URL(value string) ([]byte, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, errors.New("missing jwk coordinate")
	}
	return base64.RawURLEncoding.DecodeString(trimmed)
}

func validateJWKSClaims(claims *userClaims, cfg runtimeAuthConfig) error {
	if claims == nil {
		return errors.New("missing claims")
	}
	if cfg.supabaseURL == "" {
		return nil
	}

	expectedIssuer := strings.TrimRight(cfg.supabaseURL, "/") + "/auth/v1"
	if claims.Issuer != "" && claims.Issuer != expectedIssuer {
		return errors.New("invalid token issuer")
	}

	return nil
}

func resolveUserRole(claims *userClaims) string {
	if claims == nil {
		return ""
	}

	if role := strings.TrimSpace(claims.Role); role != "" {
		return role
	}
	if role := strings.TrimSpace(claims.AppMetadata.Role); role != "" {
		return role
	}

	return "viewer"
}

func UserIDFromContext(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || strings.TrimSpace(userID) == "" {
		return "", false
	}
	return userID, true
}

func UserRoleFromContext(ctx context.Context) (string, bool) {
	role, ok := ctx.Value(UserRoleKey).(string)
	if !ok || strings.TrimSpace(role) == "" {
		return "", false
	}
	return role, true
}

// RequireAuth middleware para validar JWT.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		token, err := extractBearerToken(authHeader)
		if err != nil || token == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		cfg := loadRuntimeAuthConfig()
		if cfg.allowTestAuthToken && isTestToken(token) {
			ctx := context.WithValue(r.Context(), UserIDKey, testAuthUserID)
			ctx = context.WithValue(ctx, UserRoleKey, testAuthUserRole)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		claims, err := parseAndValidateClaims(token, cfg)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		userID := strings.TrimSpace(claims.Subject)
		if userID == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		ctx = context.WithValue(ctx, UserRoleKey, resolveUserRole(claims))

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole middleware para validar roles
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole, ok := r.Context().Value(UserRoleKey).(string)
			if !ok {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}

			allowed := false
			for _, role := range roles {
				if userRole == role {
					allowed = true
					break
				}
			}

			if !allowed {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
