package domain

import "time"

type OrderHistoryEntry struct {
	ID             string
	OrganizationID string
	OrderID        string
	ChangedBy      string
	ChangeType     string
	FieldName      string
	OldValue       string
	NewValue       string
	CreatedAt      time.Time
}

type OrderHistoryRepository interface {
	Create(entry *OrderHistoryEntry) error
	FindByOrderID(orderID, organizationID string) ([]*OrderHistoryEntry, error)
}
