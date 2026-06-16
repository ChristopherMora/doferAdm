package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	ordersDomain "github.com/dofer/panel-api/internal/modules/orders/domain"
	"github.com/dofer/panel-api/internal/modules/quotes/domain"
	"github.com/google/uuid"
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
	organizationID := organizationIDFromContext(ctx)
	quote, err := h.quoteRepo.FindByID(cmd.QuoteID, organizationID)
	if err != nil {
		return nil, err
	}

	// Verificar que la cotización esté aprobada
	if quote.Status != "approved" {
		return nil, ErrQuoteNotApproved
	}

	// Obtener los items de la cotización
	items, err := h.quoteRepo.GetItems(cmd.QuoteID, organizationID)
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
	order.OrganizationID = organizationID

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

	// Crear los items individuales de la orden y calcular el total
	totalAmount := 0.0
	for _, quoteItem := range items {
		orderItem := &ordersDomain.OrderItem{
			ID:             uuid.New().String(),
			OrganizationID: organizationID,
			OrderID:        order.ID,
			ProductName:    quoteItem.ProductName,
			Description:    quoteItem.Description,
			Quantity:       quoteItem.Quantity,
			UnitPrice:      quoteItem.UnitPrice,
			Total:          quoteItem.Total,
			IsCompleted:    false,
		}

		if err := h.orderRepo.CreateOrderItem(orderItem); err != nil {
			// Log error but continue
			fmt.Printf("Warning: could not create order item: %v\n", err)
		} else {
			totalAmount += orderItem.Total
		}
	}

	// Actualizar el amount de la orden con el total calculado
	order.Amount = totalAmount
	order.Balance = totalAmount // Balance inicial es igual al total

	// Copiar pagos de cotización a orden (sincronización automática)
	quotePayments, err := h.quoteRepo.GetPayments(cmd.QuoteID, organizationID)
	if err != nil {
		fmt.Printf("Warning: could not fetch quote payments: %v\n", err)
	} else if len(quotePayments) > 0 {
		for _, quotePayment := range quotePayments {
			orderPayment := &ordersDomain.OrderPayment{
				ID:             uuid.New().String(),
				OrganizationID: organizationID,
				OrderID:        order.ID,
				Amount:         quotePayment.Amount,
				PaymentMethod:  quotePayment.PaymentMethod,
				PaymentDate:    quotePayment.PaymentDate,
				Notes:          fmt.Sprintf("🔄 Copiado desde cotización %s: %s", quote.QuoteNumber, quotePayment.Notes),
				CreatedBy:      quotePayment.CreatedBy,
				CreatedAt:      time.Now(),
			}

			if err := h.orderRepo.AddPayment(orderPayment); err != nil {
				fmt.Printf("Warning: could not copy payment to order: %v\n", err)
			}
		}

		// Actualizar los montos de la orden
		order.AmountPaid = quote.AmountPaid
		order.Balance = quote.Balance
		if err := h.orderRepo.Update(order); err != nil {
			fmt.Printf("Warning: could not update order payment amounts: %v\n", err)
		}
	}

	// Actualizar la cotización para marcarla como convertida
	quote.ConvertedToOrderID = order.ID
	if err := h.quoteRepo.Update(quote); err != nil {
		// Log error pero no fallar, la orden ya fue creada
		fmt.Printf("Warning: could not update quote with order ID: %v\n", err)
	}

	return order, nil
}
