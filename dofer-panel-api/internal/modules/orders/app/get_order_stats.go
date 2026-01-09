package app

import (
	"context"
	"time"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type OrderStats struct {
	TotalOrders    int            `json:"total_orders"`
	OrdersByStatus map[string]int `json:"orders_by_status"`
	UrgentOrders   int            `json:"urgent_orders"`
	TodayOrders    int            `json:"today_orders"`
	CompletedToday int            `json:"completed_today"`
	AveragePerDay  float64        `json:"average_per_day"`
}

type GetOrderStatsHandler struct {
	repo domain.OrderRepository
}

func NewGetOrderStatsHandler(repo domain.OrderRepository) *GetOrderStatsHandler {
	return &GetOrderStatsHandler{repo: repo}
}

func isToday(t time.Time) bool {
	now := time.Now()
	y1, m1, d1 := t.Date()
	y2, m2, d2 := now.Date()
	return y1 == y2 && m1 == m2 && d1 == d2
}

func (h *GetOrderStatsHandler) Handle(ctx context.Context) (*OrderStats, error) {
	// Get all orders (we'll aggregate in memory for simplicity)
	// For production with many orders, this should be done with SQL aggregations
	filters := domain.OrderFilters{
		Limit:  1000, // Reasonable limit
		Offset: 0,
	}

	orders, err := h.repo.FindAll(filters)
	if err != nil {
		return nil, err
	}

	stats := &OrderStats{
		TotalOrders:    len(orders),
		OrdersByStatus: make(map[string]int),
		UrgentOrders:   0,
		TodayOrders:    0,
		CompletedToday: 0,
	}

	// Calculate stats
	for _, order := range orders {
		// Count by status
		stats.OrdersByStatus[string(order.Status)]++

		// Count urgent
		if order.Priority == domain.PriorityUrgent {
			stats.UrgentOrders++
		}

		// Count today's orders (created today)
		if isToday(order.CreatedAt) {
			stats.TodayOrders++
		}

		// Count completed today
		if order.CompletedAt != nil && isToday(*order.CompletedAt) {
			stats.CompletedToday++
		}
	}

	return stats, nil
}
