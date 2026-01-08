package transport

import (
	"encoding/json"
	"net/http"

	"github.com/dofer/panel-api/internal/modules/auth/app"
	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
)

type AuthHandler struct {
	getUserHandler *app.GetUserByIDHandler
}

func NewAuthHandler(getUserHandler *app.GetUserByIDHandler) *AuthHandler {
	return &AuthHandler{
		getUserHandler: getUserHandler,
	}
}

type UserResponse struct {
	ID       string `json:"id"`
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
