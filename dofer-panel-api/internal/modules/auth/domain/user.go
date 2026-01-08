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
