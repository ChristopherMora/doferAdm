package transport

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/dofer/panel-api/internal/modules/auth/app"
	"github.com/dofer/panel-api/internal/modules/auth/domain"
	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
	"github.com/go-chi/chi/v5"
)

type AuthHandler struct {
	getUserHandler *app.GetUserByIDHandler
	userRepo       domain.UserRepository
}

func NewAuthHandler(getUserHandler *app.GetUserByIDHandler, userRepo domain.UserRepository) *AuthHandler {
	return &AuthHandler{
		getUserHandler: getUserHandler,
		userRepo:       userRepo,
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
