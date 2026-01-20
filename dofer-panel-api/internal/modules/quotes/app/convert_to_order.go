package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	ordersDomain "github.com/dofer/panel-api/internal/modules/orders/domain"
	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

var (
	ErrQuoteNotApproved = errors.New("quote must be approved to convert to order")
	ErrQuoteNoItems     = errors.New("quote must have at least one item")
)

type ConvertToOrderCommand struct {
	QuoteID string
}

type ConvertToOrderHandler struct {
	quoteRepo domain.QuoteRepository
	orderRepo ordersDomain.OrderRepository
}

func NewConvertToOrderHandler(quoteRepo domain.QuoteRepository, orderRepo ordersDomain.OrderRepository) *ConvertToOrderHandler {
	return &ConvertToOrderHandler{
		quoteRepo: quoteRepo,
		orderRepo: orderRepo,
	}
}

func (h *ConvertToOrderHandler) Handle(ctx context.Context, cmd ConvertToOrderCommand) (*ordersDomain.Order, error) {
	// Obtener la cotización
	quote, err := h.quoteRepo.FindByID(cmd.QuoteID)
	if err != nil {
		return nil, err
	}

	// Verificar que la cotización esté aprobada
	if quote.Status != "approved" {
		return nil, ErrQuoteNotApproved
	}

	// Obtener los items de la cotización
	items, err := h.quoteRepo.GetItems(cmd.QuoteID)
	if err != nil {
		return nil, err
	}

	if len(items) == 0 {
		return nil, ErrQuoteNoItems
	}

	// Crear descripción del producto con todos los items
	productDescription := fmt.Sprintf("Pedido desde cotización %s", quote.QuoteNumber)
	if len(items) > 0 {
		productDescription = items[0].ProductName
		if len(items) > 1 {
			productDescription += fmt.Sprintf(" (+%d items más)", len(items)-1)
		}
	}

	// Calcular cantidad total
	totalQuantity := 0
	for _, item := range items {
		totalQuantity += item.Quantity
	}

	// Auto-generar número de orden basado en timestamp
	orderNumber := fmt.Sprintf("ORD-%s", time.Now().Format("20060102150405"))

	// Crear la orden
	order, err := ordersDomain.NewOrder(
		orderNumber,
		ordersDomain.PlatformLocal, // Las cotizaciones convertidas son pedidos locales
		quote.CustomerName,
		productDescription,
		totalQuantity,
	)
	if err != nil {
		return nil, err
	}

	// Copiar información del cliente
	order.CustomerEmail = quote.CustomerEmail
	order.CustomerPhone = quote.CustomerPhone
	
	// Agregar notas simplificadas
	notesDetail := fmt.Sprintf("🔄 Generado desde cotización %s\n", quote.QuoteNumber)
	notesDetail += fmt.Sprintf("💰 Total: $%.2f | Items: %d\n", quote.Total, len(items))
	
	if quote.Notes != "" {
		notesDetail += fmt.Sprintf("\n📝 %s", quote.Notes)
	}
	
	order.Notes = notesDetail

	// Guardar la orden
	if err := h.orderRepo.Create(order); err != nil {
		return nil, err
	}

	// Actualizar la cotización para marcarla como convertida
	quote.ConvertedToOrderID = order.ID
	if err := h.quoteRepo.Update(quote); err != nil {
		// Log error pero no fallar, la orden ya fue creada
		fmt.Printf("Warning: could not update quote with order ID: %v\n", err)
	}

	return order, nil
}
