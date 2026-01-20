package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

type DeleteQuoteItemCommand struct {
	QuoteID string
	ItemID  string
}

type DeleteQuoteItemHandler struct {
	repo domain.QuoteRepository
}

func NewDeleteQuoteItemHandler(repo domain.QuoteRepository) *DeleteQuoteItemHandler {
	return &DeleteQuoteItemHandler{repo: repo}
}

func (h *DeleteQuoteItemHandler) Handle(ctx context.Context, cmd DeleteQuoteItemCommand) error {
	// Eliminar el item
	if err := h.repo.DeleteQuoteItem(ctx, cmd.QuoteID, cmd.ItemID); err != nil {
		return err
	}

	// Recalcular totales de la cotización
	items, err := h.repo.GetItems(cmd.QuoteID)
	if err != nil {
		return err
	}

	// Calcular nuevo subtotal
	var subtotal float64
	for _, item := range items {
		subtotal += item.Total
	}

	// Obtener la cotización actual
	quote, err := h.repo.FindByID(cmd.QuoteID)
	if err != nil {
		return err
	}

	// Actualizar totales
	quote.Subtotal = subtotal
	quote.Tax = subtotal * 0.16 // IVA 16%
	quote.Total = quote.Subtotal + quote.Tax

	// Guardar cotización actualizada
	return h.repo.Update(quote)
}
