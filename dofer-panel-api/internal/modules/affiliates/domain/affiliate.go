package domain

import "time"

type CommissionType string
type AffiliateStatus string

const (
	CommissionPercentage CommissionType = "percentage"
	CommissionFixed      CommissionType = "fixed"
)

const (
	AffiliateActive    AffiliateStatus = "active"
	AffiliateSuspended AffiliateStatus = "suspended"
)

type Affiliate struct {
	ID              string          `json:"id"`
	OrganizationID  string          `json:"organization_id"`
	UserID          string          `json:"user_id"`
	ReferralCode    string          `json:"referral_code"`
	DisplayName     string          `json:"display_name"`
	Email           string          `json:"email"`
	Phone           string          `json:"phone,omitempty"`
	CommissionType  CommissionType  `json:"commission_type"`
	CommissionValue float64         `json:"commission_value"`
	Status          AffiliateStatus `json:"status"`
	Notes           string          `json:"notes,omitempty"`
	CreatedBy       string          `json:"created_by,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

// CalculateCommission aplica la comisión configurada sobre el precio final
// de un pedido aprobado. El resultado se guarda como snapshot, nunca se
// recalcula retroactivamente si la comisión del afiliado cambia después.
func (a *Affiliate) CalculateCommission(finalPrice float64) float64 {
	if a.CommissionType == CommissionFixed {
		return a.CommissionValue
	}
	return finalPrice * (a.CommissionValue / 100)
}
