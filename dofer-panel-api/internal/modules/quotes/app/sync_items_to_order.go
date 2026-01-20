package app

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	ordersDomain "github.com/dofer/panel-api/internal/modules/orders/domain"
	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

type SyncItemsToOrderCommand struct {
	QuoteID string
}

type SyncItemsToOrderHandler struct {
	quoteRepo domain.QuoteRepository
	orderRepo ordersDomain.OrderRepository
}

func NewSyncItemsToOrderHandler(quoteRepo domain.QuoteRepository, orderRepo ordersDomain.OrderRepository) *SyncItemsToOrderHandler {
	return &SyncItemsToOrderHandler{
		quoteRepo: quoteRepo,
		orderRepo: orderRepo,
	}
}

func (h *SyncItemsToOrderHandler) Handle(ctx context.Context, cmd SyncItemsToOrderCommand) error {
	// Obtener la cotización
	quote, err := h.quoteRepo.FindByID(cmd.QuoteID)
	if err != nil {
		return err
	}

	// Verificar que tenga un pedido asociado
	if quote.ConvertedToOrderID == "" {
		return fmt.Errorf("quote has not been converted to order yet")
	}

	// Obtener los items de la cotización
	items, err := h.quoteRepo.GetItems(cmd.QuoteID)
	if err != nil {
		return err
	}

	if len(items) == 0 {
		return fmt.Errorf("quote has no items")
	}

	// Verificar si el pedido ya tiene items
	existingItems, err := h.orderRepo.GetOrderItems(quote.ConvertedToOrderID)
	if err != nil {
		return err
	}

	// Si ya tiene items, no hacer nada
	if len(existingItems) > 0 {
		return fmt.Errorf("order already has %d items", len(existingItems))
	}

	// Crear los items individuales de la orden
	for _, quoteItem := range items {
		orderItem := &ordersDomain.OrderItem{
			ID:          uuid.New().String(),
			OrderID:     quote.ConvertedToOrderID,
			ProductName: quoteItem.ProductName,
			Description: quoteItem.Description,
			Quantity:    quoteItem.Quantity,
			UnitPrice:   quoteItem.UnitPrice,
			Total:       quoteItem.Total,
			IsCompleted: false,
		}
		
		if err := h.orderRepo.CreateOrderItem(orderItem); err != nil {
			return fmt.Errorf("could not create order item: %v", err)
		}
	}

	return nil
}
