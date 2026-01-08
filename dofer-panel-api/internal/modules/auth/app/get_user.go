package app

import (
	"context"
	"errors"

	"github.com/dofer/panel-api/internal/modules/auth/domain"
)

var (
	ErrUserNotFound = errors.New("user not found")
	ErrInvalidToken = errors.New("invalid token")
)

type GetUserByIDQuery struct {
	UserID string
}

type GetUserByIDHandler struct {
	repo domain.UserRepository
}

func NewGetUserByIDHandler(repo domain.UserRepository) *GetUserByIDHandler {
	return &GetUserByIDHandler{repo: repo}
}

func (h *GetUserByIDHandler) Handle(ctx context.Context, query GetUserByIDQuery) (*domain.User, error) {
	user, err := h.repo.FindByID(query.UserID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	return user, nil
}
