package app

import (
	"context"
	"fmt"
	"strings"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
	"github.com/google/uuid"
)

type CreateQuoteTemplateCommand struct {
	Name             string
	Description      string
	Material         string
	InfillPercentage float64
	LayerHeight      float64
	PrintSpeed       float64
	BaseCost         float64
	MarkupPercentage float64
	CreatedBy        string
}

type CreateQuoteTemplateHandler struct {
	repo domain.QuoteRepository
}

func NewCreateQuoteTemplateHandler(repo domain.QuoteRepository) *CreateQuoteTemplateHandler {
	return &CreateQuoteTemplateHandler{repo: repo}
}

func (h *CreateQuoteTemplateHandler) Handle(ctx context.Context, cmd CreateQuoteTemplateCommand) (*domain.QuoteTemplate, error) {
	_ = ctx

	name := strings.TrimSpace(cmd.Name)
	if name == "" {
		return nil, fmt.Errorf("template name is required")
	}

	material := strings.TrimSpace(cmd.Material)
	if material == "" {
		material = "PLA"
	}

	if cmd.InfillPercentage < 0 || cmd.InfillPercentage > 100 {
		return nil, fmt.Errorf("infill_percentage must be between 0 and 100")
	}
	if cmd.LayerHeight <= 0 {
		return nil, fmt.Errorf("layer_height must be greater than 0")
	}
	if cmd.PrintSpeed <= 0 {
		return nil, fmt.Errorf("print_speed must be greater than 0")
	}
	if cmd.BaseCost < 0 {
		return nil, fmt.Errorf("base_cost cannot be negative")
	}
	if cmd.MarkupPercentage < 0 {
		return nil, fmt.Errorf("markup_percentage cannot be negative")
	}

	template := &domain.QuoteTemplate{
		ID:               uuid.New().String(),
		Name:             name,
		Description:      strings.TrimSpace(cmd.Description),
		Material:         material,
		InfillPercentage: cmd.InfillPercentage,
		LayerHeight:      cmd.LayerHeight,
		PrintSpeed:       cmd.PrintSpeed,
		BaseCost:         cmd.BaseCost,
		MarkupPercentage: cmd.MarkupPercentage,
		CreatedBy:        strings.TrimSpace(cmd.CreatedBy),
	}

	if err := h.repo.CreateTemplate(template); err != nil {
		return nil, err
	}

	saved, err := h.repo.FindTemplateByID(template.ID)
	if err != nil {
		return template, nil
	}

	return saved, nil
}
