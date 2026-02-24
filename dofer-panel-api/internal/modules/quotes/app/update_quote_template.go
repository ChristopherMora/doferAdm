package app

import (
	"context"
	"fmt"
	"strings"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
	"github.com/jackc/pgx/v5"
)

type UpdateQuoteTemplateCommand struct {
	TemplateID       string
	Name             *string
	Description      *string
	Material         *string
	InfillPercentage *float64
	LayerHeight      *float64
	PrintSpeed       *float64
	BaseCost         *float64
	MarkupPercentage *float64
}

type UpdateQuoteTemplateHandler struct {
	repo domain.QuoteRepository
}

func NewUpdateQuoteTemplateHandler(repo domain.QuoteRepository) *UpdateQuoteTemplateHandler {
	return &UpdateQuoteTemplateHandler{repo: repo}
}

func (h *UpdateQuoteTemplateHandler) Handle(ctx context.Context, cmd UpdateQuoteTemplateCommand) (*domain.QuoteTemplate, error) {
	_ = ctx

	template, err := h.repo.FindTemplateByID(cmd.TemplateID)
	if err != nil {
		return nil, err
	}
	if template == nil {
		return nil, pgx.ErrNoRows
	}

	if cmd.Name != nil {
		name := strings.TrimSpace(*cmd.Name)
		if name == "" {
			return nil, fmt.Errorf("template name cannot be empty")
		}
		template.Name = name
	}

	if cmd.Description != nil {
		template.Description = strings.TrimSpace(*cmd.Description)
	}

	if cmd.Material != nil {
		material := strings.TrimSpace(*cmd.Material)
		if material == "" {
			material = "PLA"
		}
		template.Material = material
	}

	if cmd.InfillPercentage != nil {
		if *cmd.InfillPercentage < 0 || *cmd.InfillPercentage > 100 {
			return nil, fmt.Errorf("infill_percentage must be between 0 and 100")
		}
		template.InfillPercentage = *cmd.InfillPercentage
	}

	if cmd.LayerHeight != nil {
		if *cmd.LayerHeight <= 0 {
			return nil, fmt.Errorf("layer_height must be greater than 0")
		}
		template.LayerHeight = *cmd.LayerHeight
	}

	if cmd.PrintSpeed != nil {
		if *cmd.PrintSpeed <= 0 {
			return nil, fmt.Errorf("print_speed must be greater than 0")
		}
		template.PrintSpeed = *cmd.PrintSpeed
	}

	if cmd.BaseCost != nil {
		if *cmd.BaseCost < 0 {
			return nil, fmt.Errorf("base_cost cannot be negative")
		}
		template.BaseCost = *cmd.BaseCost
	}

	if cmd.MarkupPercentage != nil {
		if *cmd.MarkupPercentage < 0 {
			return nil, fmt.Errorf("markup_percentage cannot be negative")
		}
		template.MarkupPercentage = *cmd.MarkupPercentage
	}

	if err := h.repo.UpdateTemplate(template); err != nil {
		return nil, err
	}

	return h.repo.FindTemplateByID(cmd.TemplateID)
}
