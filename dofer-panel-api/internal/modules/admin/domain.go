package admin

import "time"

type OrganizationSummary struct {
	ID                    string     `json:"id"`
	Name                  string     `json:"name"`
	Slug                  string     `json:"slug"`
	Members               int        `json:"members"`
	Orders                int        `json:"orders"`
	Quotes                int        `json:"quotes"`
	Customers             int        `json:"customers"`
	Products              int        `json:"products"`
	SubscriptionPlan      string     `json:"subscription_plan"`
	SubscriptionStatus    string     `json:"subscription_status"`
	SubscriptionStartsAt  *time.Time `json:"subscription_starts_at,omitempty"`
	SubscriptionEndsAt    *time.Time `json:"subscription_ends_at,omitempty"`
	GraceEndsAt           *time.Time `json:"grace_ends_at,omitempty"`
	AccessSuspendedAt     *time.Time `json:"access_suspended_at,omitempty"`
	SuspensionReason      string     `json:"suspension_reason"`
	BillingNotes          string     `json:"billing_notes"`
	MaxMembers            int        `json:"max_members"`
	MaxOrdersPerMonth     int        `json:"max_orders_per_month"`
	IsAccessBlocked       bool       `json:"is_access_blocked"`
	AccessMessage         string     `json:"access_message"`
	DaysUntilAccessChange *int       `json:"days_until_access_change,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

type UpdateOrganizationRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type UpdateOrganizationSubscriptionRequest struct {
	SubscriptionPlan     string     `json:"subscription_plan"`
	SubscriptionStatus   string     `json:"subscription_status"`
	SubscriptionStartsAt *time.Time `json:"subscription_starts_at"`
	SubscriptionEndsAt   *time.Time `json:"subscription_ends_at"`
	GraceEndsAt          *time.Time `json:"grace_ends_at"`
	SuspensionReason     string     `json:"suspension_reason"`
	BillingNotes         string     `json:"billing_notes"`
	MaxMembers           int        `json:"max_members"`
	MaxOrdersPerMonth    int        `json:"max_orders_per_month"`
}

type OrganizationOverview struct {
	Admins                  int                     `json:"admins"`
	Operators               int                     `json:"operators"`
	Viewers                 int                     `json:"viewers"`
	ActiveOrders            int                     `json:"active_orders"`
	DeliveredOrders         int                     `json:"delivered_orders"`
	UrgentOrders            int                     `json:"urgent_orders"`
	OverdueProductionOrders int                     `json:"overdue_production_orders"`
	UnassignedOrders        int                     `json:"unassigned_orders"`
	DraftQuotes             int                     `json:"draft_quotes"`
	SentQuotes              int                     `json:"sent_quotes"`
	AcceptedQuotes          int                     `json:"accepted_quotes"`
	ExpiredQuotes           int                     `json:"expired_quotes"`
	AvailablePrinters       int                     `json:"available_printers"`
	BusyPrinters            int                     `json:"busy_printers"`
	MaintenancePrinters     int                     `json:"maintenance_printers"`
	OfflinePrinters         int                     `json:"offline_printers"`
	ActiveProducts          int                     `json:"active_products"`
	InactiveProducts        int                     `json:"inactive_products"`
	OrdersLast30Days        int                     `json:"orders_last_30_days"`
	QuotesLast30Days        int                     `json:"quotes_last_30_days"`
	CustomersLast30Days     int                     `json:"customers_last_30_days"`
	PaymentsLast30Days      int                     `json:"payments_last_30_days"`
	OrderValue              float64                 `json:"order_value"`
	QuoteValue              float64                 `json:"quote_value"`
	Collected               float64                 `json:"collected"`
	Pending                 float64                 `json:"pending"`
	Overdue                 float64                 `json:"overdue"`
	CollectionRate          float64                 `json:"collection_rate"`
	CompletionRate          float64                 `json:"completion_rate"`
	QuoteAcceptanceRate     float64                 `json:"quote_acceptance_rate"`
	LastOrderAt             *time.Time              `json:"last_order_at,omitempty"`
	LastPaymentAt           *time.Time              `json:"last_payment_at,omitempty"`
	RoleBreakdown           []OrganizationBreakdown `json:"role_breakdown"`
	OrderStatusBreakdown    []OrganizationBreakdown `json:"order_status_breakdown"`
	QuoteStatusBreakdown    []OrganizationBreakdown `json:"quote_status_breakdown"`
	PlatformBreakdown       []OrganizationBreakdown `json:"platform_breakdown"`
}

type OrganizationBreakdown struct {
	Key   string `json:"key"`
	Count int    `json:"count"`
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
