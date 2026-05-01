package domain

import (
	"time"
)

type Role string

const (
	RoleAdmin    Role = "admin"
	RoleOperator Role = "operator"
	RoleViewer   Role = "viewer"
)

type User struct {
	ID        string
	Email     string
	FullName  string
	Role      Role
	CreatedAt time.Time
	UpdatedAt time.Time
}

type OrganizationMember struct {
	UserID              string     `json:"user_id"`
	Email               string     `json:"email"`
	FullName            string     `json:"full_name"`
	UserRole            Role       `json:"user_role"`
	OrganizationID      string     `json:"organization_id"`
	OrganizationRole    Role       `json:"organization_role"`
	MembershipCreatedAt time.Time  `json:"membership_created_at"`
	MembershipUpdatedAt time.Time  `json:"membership_updated_at"`
	AccountCreatedAt    time.Time  `json:"account_created_at"`
	AccountUpdatedAt    time.Time  `json:"account_updated_at"`
	AuthLinked          bool       `json:"auth_linked"`
	IsLastAdmin         bool       `json:"is_last_admin"`
	AssignedOrders      int        `json:"assigned_orders"`
	ActiveOrders        int        `json:"active_orders"`
	DeliveredOrders     int        `json:"delivered_orders"`
	TotalMinutes        int        `json:"total_minutes"`
	LastActivityAt      *time.Time `json:"last_activity_at,omitempty"`
}

func (r Role) IsValid() bool {
	return r == RoleAdmin || r == RoleOperator || r == RoleViewer
}

func (r Role) CanAccessAdmin() bool {
	return r == RoleAdmin
}

func (r Role) CanManageOrders() bool {
	return r == RoleAdmin || r == RoleOperator
}

func (r Role) CanViewOnly() bool {
	return r == RoleViewer
}
