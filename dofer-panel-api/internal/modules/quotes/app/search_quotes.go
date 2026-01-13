package app

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

type SearchQuotesHandler struct {
	repo domain.QuoteRepository
}

func NewSearchQuotesHandler(repo domain.QuoteRepository) *SearchQuotesHandler {
	return &SearchQuotesHandler{repo: repo}
}

type SearchQuotesParams struct {
	Query    string
	Status   string
	Customer string
	DateFrom string
	DateTo   string
	MinTotal float64
	MaxTotal float64
}

func (h *SearchQuotesHandler) Handle(ctx context.Context, params SearchQuotesParams) ([]domain.Quote, error) {
	// Get all quotes (empty filters to get everything)
	quotePtrs, err := h.repo.FindAll(nil)
	if err != nil {
		return nil, fmt.Errorf("error getting quotes: %w", err)
	}

	// Convert []*Quote to []Quote
	allQuotes := make([]domain.Quote, 0, len(quotePtrs))
	for _, ptr := range quotePtrs {
		if ptr != nil {
			allQuotes = append(allQuotes, *ptr)
		}
	}

	// Parse dates if provided
	var dateFrom, dateTo time.Time
	if params.DateFrom != "" {
		dateFrom, err = time.Parse("2006-01-02", params.DateFrom)
		if err != nil {
			return nil, fmt.Errorf("invalid date_from format: %w", err)
		}
	}
	if params.DateTo != "" {
		dateTo, err = time.Parse("2006-01-02", params.DateTo)
		if err != nil {
			return nil, fmt.Errorf("invalid date_to format: %w", err)
		}
		// Set to end of day
		dateTo = dateTo.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	}

	// Filter quotes
	var filtered []domain.Quote
	for _, quote := range allQuotes {
		// Skip if doesn't match filters
		if !matchesQuoteFilters(quote, params, dateFrom, dateTo) {
			continue
		}
		filtered = append(filtered, quote)
	}

	return filtered, nil
}

func matchesQuoteFilters(quote domain.Quote, params SearchQuotesParams, dateFrom, dateTo time.Time) bool {
	// Query filter (search in QuoteNumber, CustomerName, Notes)
	if params.Query != "" {
		query := strings.ToLower(params.Query)
		quoteNumber := strings.ToLower(quote.QuoteNumber)
		customerName := strings.ToLower(quote.CustomerName)
		notes := strings.ToLower(quote.Notes)

		if !strings.Contains(quoteNumber, query) &&
			!strings.Contains(customerName, query) &&
			!strings.Contains(notes, query) {
			return false
		}
	}

	// Status filter
	if params.Status != "" && quote.Status != params.Status {
		return false
	}

	// Customer filter
	if params.Customer != "" {
		customer := strings.ToLower(params.Customer)
		customerName := strings.ToLower(quote.CustomerName)
		if !strings.Contains(customerName, customer) {
			return false
		}
	}

	// Date range filter
	if !dateFrom.IsZero() && quote.CreatedAt.Before(dateFrom) {
		return false
	}
	if !dateTo.IsZero() && quote.CreatedAt.After(dateTo) {
		return false
	}

	// Total amount filter
	if params.MinTotal > 0 && quote.Total < params.MinTotal {
		return false
	}
	if params.MaxTotal > 0 && quote.Total > params.MaxTotal {
		return false
	}

	return true
}
