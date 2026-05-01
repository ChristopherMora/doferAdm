package admin

import "time"

type OrganizationSummary struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	Members   int       `json:"members"`
	Orders    int       `json:"orders"`
	Quotes    int       `json:"quotes"`
	Customers int       `json:"customers"`
	Products  int       `json:"products"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type UpdateOrganizationRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type FinanceSummary struct {
	TotalOrders        int     `json:"total_orders"`
	TotalQuotes        int     `json:"total_quotes"`
	OrderValue         float64 `json:"order_value"`
	QuoteValue         float64 `json:"quote_value"`
	Collected          float64 `json:"collected"`
	Pending            float64 `json:"pending"`
	Overdue            float64 `json:"overdue"`
	CollectionRate     float64 `json:"collection_rate"`
	PaymentsCount      int     `json:"payments_count"`
	OrderPaymentsCount int     `json:"order_payments_count"`
	QuotePaymentsCount int     `json:"quote_payments_count"`
}

type FinancePayment struct {
	ID            string    `json:"id"`
	SourceType    string    `json:"source_type"`
	SourceID      string    `json:"source_id"`
	Reference     string    `json:"reference"`
	CustomerName  string    `json:"customer_name"`
	Amount        float64   `json:"amount"`
	PaymentMethod string    `json:"payment_method"`
	PaymentDate   time.Time `json:"payment_date"`
	Notes         string    `json:"notes"`
	CreatedBy     string    `json:"created_by"`
	CreatedAt     time.Time `json:"created_at"`
}

type AuditLog struct {
	ID          string                 `json:"id"`
	ActorUserID string                 `json:"actor_user_id"`
	ActorEmail  string                 `json:"actor_email"`
	Action      string                 `json:"action"`
	EntityType  string                 `json:"entity_type"`
	EntityID    string                 `json:"entity_id"`
	Metadata    map[string]interface{} `json:"metadata"`
	CreatedAt   time.Time              `json:"created_at"`
}

type UserMetric struct {
	UserID          string  `json:"user_id"`
	Email           string  `json:"email"`
	FullName        string  `json:"full_name"`
	Role            string  `json:"role"`
	AssignedOrders  int     `json:"assigned_orders"`
	DeliveredOrders int     `json:"delivered_orders"`
	ActiveOrders    int     `json:"active_orders"`
	TotalMinutes    int     `json:"total_minutes"`
	AverageMinutes  float64 `json:"average_minutes"`
}

type Receivable struct {
	ID           string     `json:"id"`
	Type         string     `json:"type"`
	Reference    string     `json:"reference"`
	CustomerName string     `json:"customer_name"`
	Total        float64    `json:"total"`
	AmountPaid   float64    `json:"amount_paid"`
	Balance      float64    `json:"balance"`
	DueDate      *time.Time `json:"due_date,omitempty"`
	Status       string     `json:"status"`
	DaysOverdue  int        `json:"days_overdue"`
}

type FinanceCut struct {
	Period         string    `json:"period"`
	PeriodStart    time.Time `json:"period_start"`
	OrderPayments  float64   `json:"order_payments"`
	QuotePayments  float64   `json:"quote_payments"`
	TotalCollected float64   `json:"total_collected"`
	PaymentsCount  int       `json:"payments_count"`
}
