package transport

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/dofer/panel-api/internal/modules/auth/app"
	"github.com/dofer/panel-api/internal/modules/auth/domain"
	"github.com/dofer/panel-api/internal/platform/config"
	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
	"github.com/go-chi/chi/v5"
)

type AuthHandler struct {
	getUserHandler *app.GetUserByIDHandler
	userRepo       domain.UserRepository
	cfg            *config.Config
}

func NewAuthHandler(getUserHandler *app.GetUserByIDHandler, userRepo domain.UserRepository, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		getUserHandler: getUserHandler,
		userRepo:       userRepo,
		cfg:            cfg,
	}
}

type UserResponse struct {
	ID               string `json:"id"`
	Email            string `json:"email"`
	FullName         string `json:"full_name"`
	Role             string `json:"role"`
	OrganizationID   string `json:"organization_id,omitempty"`
	OrganizationRole string `json:"organization_role,omitempty"`
}

type organizationMemberResponse struct {
	UserID              string `json:"user_id"`
	Email               string `json:"email"`
	FullName            string `json:"full_name"`
	UserRole            string `json:"user_role"`
	OrganizationID      string `json:"organization_id"`
	OrganizationRole    string `json:"organization_role"`
	MembershipCreatedAt string `json:"membership_created_at"`
}

type updateMemberRoleRequest struct {
	Role string `json:"role"`
}

type inviteMemberRequest struct {
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := h.getUserHandler.Handle(r.Context(), app.GetUserByIDQuery{
		UserID: userID,
	})

	if err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	response := UserResponse{
		ID:       user.ID,
		Email:    user.Email,
		FullName: user.FullName,
		Role:     string(user.Role),
	}
	if organizationID, ok := middleware.OrganizationIDFromContext(r.Context()); ok {
		response.OrganizationID = organizationID
	}
	if organizationRole, ok := middleware.OrganizationRoleFromContext(r.Context()); ok {
		response.OrganizationRole = organizationRole
		response.Role = organizationRole
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *AuthHandler) ListOrganizationMembers(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := middleware.OrganizationIDFromContext(r.Context())
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	members, err := h.userRepo.ListOrganizationMembers(organizationID)
	if err != nil {
		http.Error(w, "could not load organization members", http.StatusInternalServerError)
		return
	}

	response := make([]organizationMemberResponse, 0, len(members))
	for _, member := range members {
		response = append(response, organizationMemberResponse{
			UserID:              member.UserID,
			Email:               member.Email,
			FullName:            member.FullName,
			UserRole:            string(member.UserRole),
			OrganizationID:      member.OrganizationID,
			OrganizationRole:    string(member.OrganizationRole),
			MembershipCreatedAt: member.MembershipCreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"members": response,
		"total":   len(response),
	})
}

func (h *AuthHandler) InviteOrganizationMember(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := middleware.OrganizationIDFromContext(r.Context())
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	var request inviteMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	role := strings.ToLower(strings.TrimSpace(request.Role))
	if role == "" {
		role = "operator"
	}

	member, err := h.userRepo.InviteOrganizationMember(organizationID, request.Email, request.FullName, role)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	inviteStatus := "local_member_ready"
	if err := h.sendSupabaseInvite(r.Context(), request.Email, request.FullName, role); err == nil {
		inviteStatus = "sent"
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"member": organizationMemberResponse{
			UserID:              member.UserID,
			Email:               member.Email,
			FullName:            member.FullName,
			UserRole:            string(member.UserRole),
			OrganizationID:      member.OrganizationID,
			OrganizationRole:    string(member.OrganizationRole),
			MembershipCreatedAt: member.MembershipCreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		},
		"invite_status": inviteStatus,
	})
}

func (h *AuthHandler) UpdateOrganizationMemberRole(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := middleware.OrganizationIDFromContext(r.Context())
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	userID := strings.TrimSpace(chi.URLParam(r, "userID"))
	if userID == "" {
		http.Error(w, "user ID is required", http.StatusBadRequest)
		return
	}

	var request updateMemberRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	role := strings.ToLower(strings.TrimSpace(request.Role))
	if role == "" {
		http.Error(w, "role is required", http.StatusBadRequest)
		return
	}

	if err := h.userRepo.UpdateOrganizationMemberRole(organizationID, userID, role); err != nil {
		status := http.StatusBadRequest
		if err.Error() == "organization member not found" {
			status = http.StatusNotFound
		}
		http.Error(w, err.Error(), status)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "role updated",
	})
}

func (h *AuthHandler) RemoveOrganizationMember(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := middleware.OrganizationIDFromContext(r.Context())
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	userID := strings.TrimSpace(chi.URLParam(r, "userID"))
	if userID == "" {
		http.Error(w, "user ID is required", http.StatusBadRequest)
		return
	}

	currentUserID, _ := middleware.UserIDFromContext(r.Context())
	if userID == currentUserID {
		http.Error(w, "cannot remove your own access", http.StatusBadRequest)
		return
	}

	if err := h.userRepo.RemoveOrganizationMember(organizationID, userID); err != nil {
		status := http.StatusBadRequest
		if err.Error() == "organization member not found" {
			status = http.StatusNotFound
		}
		http.Error(w, err.Error(), status)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "member removed",
	})
}

func (h *AuthHandler) sendSupabaseInvite(ctx context.Context, email, fullName, role string) error {
	if h.cfg == nil {
		return fmt.Errorf("supabase config unavailable")
	}
	supabaseURL := strings.TrimRight(strings.TrimSpace(h.cfg.SupabaseURL), "/")
	serviceKey := strings.TrimSpace(h.cfg.SupabaseServiceRoleKey)
	email = strings.TrimSpace(email)
	if supabaseURL == "" || serviceKey == "" || email == "" {
		return fmt.Errorf("supabase invite is not configured")
	}

	payload := map[string]any{
		"email": email,
		"data": map[string]string{
			"full_name": strings.TrimSpace(fullName),
			"role":      strings.TrimSpace(role),
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, supabaseURL+"/auth/v1/invite", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("supabase invite failed with status %d", resp.StatusCode)
	}

	return nil
}
