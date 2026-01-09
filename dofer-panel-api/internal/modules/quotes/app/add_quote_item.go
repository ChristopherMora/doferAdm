package app

import (
	"context"

	costsApp "github.com/dofer/panel-api/internal/modules/costs/app"
	"github.com/dofer/panel-api/internal/modules/costs/domain"
	quoteDomain "github.com/dofer/panel-api/internal/modules/quotes/domain"
	"github.com/google/uuid"
)

type AddQuoteItemCommand struct {
	QuoteID        string
	ProductName    string
	Description    string
	WeightGrams    float64
	PrintTimeHours float64
	Quantity       int
	OtherCosts     float64
}

type AddQuoteItemHandler struct {
	quoteRepo quoteDomain.QuoteRepository
	costCalc  *costsApp.CalculateCostHandler
}

func NewAddQuoteItemHandler(quoteRepo quoteDomain.QuoteRepository, costCalc *costsApp.CalculateCostHandler) *AddQuoteItemHandler {
	return &AddQuoteItemHandler{
		quoteRepo: quoteRepo,
		costCalc:  costCalc,
	}
}

func (h *AddQuoteItemHandler) Handle(ctx context.Context, cmd AddQuoteItemCommand) error {
	// Calcular costos automáticamente
	costInput := domain.CalculationInput{
		WeightGrams:    cmd.WeightGrams,
		PrintTimeHours: cmd.PrintTimeHours,
		Quantity:       cmd.Quantity,
		OtherCosts:     cmd.OtherCosts,
	}

	breakdown, err := h.costCalc.Handle(ctx, costInput)
	if err != nil {
		return err
	}

	// Crear item con costos calculados
	item := &quoteDomain.QuoteItem{
		ID:              uuid.New().String(),
		QuoteID:         cmd.QuoteID,
		ProductName:     cmd.ProductName,
		Description:     cmd.Description,
		WeightGrams:     cmd.WeightGrams,
		PrintTimeHours:  cmd.PrintTimeHours,
		MaterialCost:    breakdown.MaterialCost,
		LaborCost:       breakdown.LaborCost,
		ElectricityCost: breakdown.ElectricityCost,
		OtherCosts:      breakdown.OtherCosts,
		Subtotal:        breakdown.Subtotal,
		Quantity:        cmd.Quantity,
		UnitPrice:       breakdown.UnitPrice,
		Total:           breakdown.Total,
	}

	if err := h.quoteRepo.AddItem(item); err != nil {
		return err
	}

	// Actualizar totales de la cotización
	return h.updateQuoteTotals(ctx, cmd.QuoteID)
}

func (h *AddQuoteItemHandler) updateQuoteTotals(ctx context.Context, quoteID string) error {
	quote, err := h.quoteRepo.FindByID(quoteID)
	if err != nil {
		return err
	}

	items, err := h.quoteRepo.GetItems(quoteID)
	if err != nil {
		return err
	}

	// Sumar totales de items
	var subtotal float64
	for _, item := range items {
		subtotal += item.Total
	}

	quote.Subtotal = subtotal
	quote.Total = subtotal - quote.Discount + quote.Tax

	return h.quoteRepo.Update(quote)
}
