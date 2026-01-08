package app

import (
	"context"
	"errors"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

var (
	ErrOrderNotFound = errors.New("order not found")
)

type CreateOrderCommand struct {
	OrderNumber   string
	Platform      string
	CustomerName  string
	CustomerEmail string
	CustomerPhone string
	ProductName   string
	Quantity      int
	Priority      string
	Notes         string
}

type CreateOrderHandler struct {
	repo domain.OrderRepository
}

func NewCreateOrderHandler(repo domain.OrderRepository) *CreateOrderHandler {
	return &CreateOrderHandler{repo: repo}
}

func (h *CreateOrderHandler) Handle(ctx context.Context, cmd CreateOrderCommand) (*domain.Order, error) {
	order, err := domain.NewOrder(
		cmd.OrderNumber,
		domain.OrderPlatform(cmd.Platform),
		cmd.CustomerName,
		cmd.ProductName,
		cmd.Quantity,
	)

	if err != nil {
		return nil, err
	}

	order.CustomerEmail = cmd.CustomerEmail
	order.CustomerPhone = cmd.CustomerPhone
	order.Notes = cmd.Notes

	if cmd.Priority != "" {
		order.Priority = domain.OrderPriority(cmd.Priority)
	}

	if err := h.repo.Create(order); err != nil {
		return nil, err
	}

	return order, nil
}
