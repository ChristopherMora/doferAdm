package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

var (
	ErrOrderNotFound = errors.New("order not found")
)

type CreateOrderCommand struct {
	Platform      string
	CustomerName  string
	CustomerEmail string
	CustomerPhone string
	ProductName   string
	ProductImage  string
	PrintFile     string
	PrintFileName string
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
	// Auto-generar número de orden basado en timestamp
	orderNumber := fmt.Sprintf("ORD-%s", time.Now().Format("20060102150405"))

	order, err := domain.NewOrder(
		orderNumber,
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
	order.ProductImage = cmd.ProductImage
	order.PrintFile = cmd.PrintFile
	order.PrintFileName = cmd.PrintFileName
	order.Notes = cmd.Notes

	if cmd.Priority != "" {
		order.Priority = domain.OrderPriority(cmd.Priority)
	}

	if err := h.repo.Create(order); err != nil {
		return nil, err
	}

	return order, nil
}
