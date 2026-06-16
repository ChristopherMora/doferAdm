package domain

import "time"

type AffiliateOrderRequestEvent struct {
	ID                      string                 `json:"id"`
	OrganizationID          string                 `json:"organization_id"`
	AffiliateOrderRequestID string                 `json:"affiliate_order_request_id"`
	ActorUserID             string                 `json:"actor_user_id,omitempty"`
	ActorRole               string                 `json:"actor_role"`
	EventType               string                 `json:"event_type"`
	Message                 string                 `json:"message,omitempty"`
	Metadata                map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt               time.Time              `json:"created_at"`
}

type AffiliateOrderRequestComment struct {
	ID                      string    `json:"id"`
	OrganizationID          string    `json:"organization_id"`
	AffiliateOrderRequestID string    `json:"affiliate_order_request_id"`
	AuthorUserID            string    `json:"author_user_id,omitempty"`
	AuthorRole              string    `json:"author_role"`
	Message                 string    `json:"message"`
	InternalOnly            bool      `json:"internal_only"`
	CreatedAt               time.Time `json:"created_at"`
}
