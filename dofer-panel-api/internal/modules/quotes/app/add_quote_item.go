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
	CustomPrice    *float64 // Precio personalizado (opcional)
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
	var unitPrice, total float64

	// Si hay precio personalizado, usarlo; si no, calcular automáticamente
	if cmd.CustomPrice != nil && *cmd.CustomPrice > 0 {
		unitPrice = *cmd.CustomPrice
		total = unitPrice * float64(cmd.Quantity)
	} else {
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

		unitPrice = breakdown.UnitPrice
		total = breakdown.Total
	}

	// Crear item con costos calculados o precio personalizado
	item := &quoteDomain.QuoteItem{
		ID:             uuid.New().String(),
		QuoteID:        cmd.QuoteID,
		ProductName:    cmd.ProductName,
		Description:    cmd.Description,
		WeightGrams:    cmd.WeightGrams,
		PrintTimeHours: cmd.PrintTimeHours,
		OtherCosts:     cmd.OtherCosts,
		Quantity:       cmd.Quantity,
		UnitPrice:      unitPrice,
		Total:          total,
	}

	// Si es cálculo automático, incluir detalles de costos
	if cmd.CustomPrice == nil {
		costInput := domain.CalculationInput{
			WeightGrams:    cmd.WeightGrams,
			PrintTimeHours: cmd.PrintTimeHours,
			Quantity:       cmd.Quantity,
			OtherCosts:     cmd.OtherCosts,
		}

		breakdown, _ := h.costCalc.Handle(ctx, costInput)
		item.MaterialCost = breakdown.MaterialCost
		item.LaborCost = breakdown.LaborCost
		item.ElectricityCost = breakdown.ElectricityCost
		item.Subtotal = breakdown.Subtotal
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
	quote.Tax = 0 // Sin IVA por ahora
	quote.Total = quote.Subtotal - quote.Discount

	return h.quoteRepo.Update(quote)
}
