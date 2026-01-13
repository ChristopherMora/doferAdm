package app

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type SearchOrdersHandler struct {
	repo domain.OrderRepository
}

func NewSearchOrdersHandler(repo domain.OrderRepository) *SearchOrdersHandler {
	return &SearchOrdersHandler{repo: repo}
}

type SearchOrdersParams struct {
	Query      string
	Status     string
	Customer   string
	Operator   string
	DateFrom   string
	DateTo     string
}

func (h *SearchOrdersHandler) Handle(ctx context.Context, params SearchOrdersParams) ([]domain.Order, error) {
	// Get all orders (no filters to get everything)
	orderPtrs, err := h.repo.FindAll(domain.OrderFilters{})
	if err != nil {
		return nil, fmt.Errorf("error getting orders: %w", err)
	}

	// Convert []*Order to []Order
	allOrders := make([]domain.Order, 0, len(orderPtrs))
	for _, ptr := range orderPtrs {
		if ptr != nil {
			allOrders = append(allOrders, *ptr)
		}
	}

	// Parse dates if provided
	var dateFrom, dateTo time.Time
	if params.DateFrom != "" {
		dateFrom, err = time.Parse("2006-01-02", params.DateFrom)
		if err != nil {
			return nil, fmt.Errorf("invalid date_from format: %w", err)
		}
	}
	if params.DateTo != "" {
		dateTo, err = time.Parse("2006-01-02", params.DateTo)
		if err != nil {
			return nil, fmt.Errorf("invalid date_to format: %w", err)
		}
		// Set to end of day
		dateTo = dateTo.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	}

	// Filter orders
	var filtered []domain.Order
	for _, order := range allOrders {
		// Skip if doesn't match filters
		if !matchesFilters(order, params, dateFrom, dateTo) {
			continue
		}
		filtered = append(filtered, order)
	}

	return filtered, nil
}

func matchesFilters(order domain.Order, params SearchOrdersParams, dateFrom, dateTo time.Time) bool {
	// Query filter (search in ProductName, OrderNumber, CustomerName)
	if params.Query != "" {
		query := strings.ToLower(params.Query)
		productName := strings.ToLower(order.ProductName)
		orderNumber := strings.ToLower(order.OrderNumber)
		customerName := strings.ToLower(order.CustomerName)
		
		if !strings.Contains(productName, query) &&
			!strings.Contains(orderNumber, query) &&
			!strings.Contains(customerName, query) {
			return false
		}
	}

	// Status filter
	if params.Status != "" && string(order.Status) != params.Status {
		return false
	}

	// Customer filter
	if params.Customer != "" {
		customer := strings.ToLower(params.Customer)
		customerName := strings.ToLower(order.CustomerName)
		if !strings.Contains(customerName, customer) {
			return false
		}
	}

	// Operator filter
	if params.Operator != "" {
		operator := strings.ToLower(params.Operator)
		assignedTo := strings.ToLower(order.AssignedTo)
		if !strings.Contains(assignedTo, operator) {
			return false
		}
	}

	// Date range filter
	if !dateFrom.IsZero() && order.CreatedAt.Before(dateFrom) {
		return false
	}
	if !dateTo.IsZero() && order.CreatedAt.After(dateTo) {
		return false
	}

	return true
}
