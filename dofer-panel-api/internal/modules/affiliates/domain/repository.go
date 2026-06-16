package domain

// AuthUserProvisioner crea la cuenta de login real (Supabase Auth) para un
// afiliado nuevo. Implementado por infra.SupabaseAdminClient.
type AuthUserProvisioner interface {
	CreateAuthUser(email string) (userID string, temporaryPassword string, err error)
}

// AffiliateFilters filtra el listado de afiliados (uso admin).
type AffiliateFilters struct {
	OrganizationID string
	Status         string
}

// OrderRequestFilters filtra solicitudes; AffiliateID siempre se respeta,
// pero quien lo resuelve a "solo mis propias solicitudes" es la capa app
// cuando el llamador es un afiliado (nunca confiar en un valor que venga
// del cliente para ese caso).
type OrderRequestFilters struct {
	OrganizationID string
	AffiliateID    string
	Status         string
	Priority       string
}

type CommissionFilters struct {
	OrganizationID string
	AffiliateID    string
	Status         string
}

type AffiliateRepository interface {
	// Affiliates
	CreateAffiliate(a *Affiliate) error
	FindAffiliateByID(id string, organizationID ...string) (*Affiliate, error)
	FindAffiliateByUserID(userID string, organizationID ...string) (*Affiliate, error)
	ListAffiliates(filters AffiliateFilters) ([]*Affiliate, error)
	UpdateAffiliate(a *Affiliate) error

	// Provisioning: inserta la fila local en users con el rol correcto
	// ANTES del primer login del afiliado (ver SyncUser en auth middleware).
	CreateAffiliateUser(id, email, fullName, organizationID string) error

	// Order requests
	CreateOrderRequest(req *AffiliateOrderRequest) error
	FindOrderRequestByID(id string, organizationID ...string) (*AffiliateOrderRequest, error)
	ListOrderRequests(filters OrderRequestFilters) ([]*AffiliateOrderRequest, error)
	UpdateOrderRequest(req *AffiliateOrderRequest) error
	UpdateOrderRequestDetails(req *AffiliateOrderRequest) error
	CountOpenOrderRequests(organizationID, affiliateID string) (int, error)

	// Order request activity
	CreateOrderRequestEvent(event *AffiliateOrderRequestEvent) error
	ListOrderRequestEvents(organizationID, requestID string) ([]*AffiliateOrderRequestEvent, error)
	CreateOrderRequestComment(comment *AffiliateOrderRequestComment) error
	ListOrderRequestComments(organizationID, requestID string, includeInternal bool) ([]*AffiliateOrderRequestComment, error)

	// Commissions
	CreateCommission(c *AffiliateCommission) error
	FindCommissionByID(id string, organizationID ...string) (*AffiliateCommission, error)
	ListCommissions(filters CommissionFilters) ([]*AffiliateCommission, error)
	UpdateCommission(c *AffiliateCommission) error

	// Stats
	GetAffiliateStats(affiliateID string, organizationID ...string) (*AffiliateStats, error)
}

type AffiliateStats struct {
	PendingRequests   int     `json:"pending_requests"`
	ApprovedRequests  int     `json:"approved_requests"`
	RejectedRequests  int     `json:"rejected_requests"`
	CommissionPending float64 `json:"commission_pending"`
	CommissionPaid    float64 `json:"commission_paid"`
	TotalOrdersAmount float64 `json:"total_orders_amount"`
}
