package app

import (
	"context"

	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
)

func organizationIDFromContext(ctx context.Context) string {
	organizationID, _ := middleware.OrganizationIDFromContext(ctx)
	return organizationID
}
