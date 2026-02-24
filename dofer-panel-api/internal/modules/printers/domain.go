package printers

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type Printer struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Model     *string   `json:"model,omitempty" db:"model"`
	Material  *string   `json:"material,omitempty" db:"material"`
	Status    string    `json:"status" db:"status"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type PrinterCurrentJob struct {
	OrderID             string     `json:"order_id"`
	AssignedAt          time.Time  `json:"assigned_at"`
	EstimatedCompletion *time.Time `json:"estimated_completion,omitempty"`
}

type PrinterWithQueue struct {
	ID         uuid.UUID          `json:"id"`
	Name       string             `json:"name"`
	Model      *string            `json:"model,omitempty"`
	Material   *string            `json:"material,omitempty"`
	Status     string             `json:"status"`
	QueueJobs  int                `json:"queue_jobs"`
	CurrentJob *PrinterCurrentJob `json:"current_job,omitempty"`
	CreatedAt  time.Time          `json:"created_at"`
	UpdatedAt  time.Time          `json:"updated_at"`
}

type AutoAssignRequest struct {
	OrderID            string  `json:"order_id"`
	Material           string  `json:"material,omitempty"`
	EstimatedTimeHours float64 `json:"estimated_time_hours,omitempty"`
	PrinterID          string  `json:"printer_id,omitempty"`
}

type AutoAssignResult struct {
	AssignmentID        string    `json:"assignment_id"`
	OrderID             string    `json:"order_id"`
	PrinterID           string    `json:"printer_id"`
	PrinterName         string    `json:"printer_name"`
	QueuePosition       int       `json:"queue_position"`
	EstimatedStart      time.Time `json:"estimated_start"`
	EstimatedCompletion time.Time `json:"estimated_completion"`
}

type CompleteAssignmentRequest struct {
	OrderID string `json:"order_id"`
}

var (
	ErrOrderNotFound        = errors.New("order not found")
	ErrPrinterNotFound      = errors.New("printer not found")
	ErrOrderAlreadyAssigned = errors.New("order already has an active printer assignment")
	ErrNoCompatiblePrinter  = errors.New("no compatible printer available")
	ErrAssignmentNotFound   = errors.New("active printer assignment not found")
	ErrPrinterUnavailable   = errors.New("printer is unavailable")
	ErrInvalidEstimatedTime = errors.New("estimated time must be greater than zero")
	ErrInvalidOrderID       = errors.New("invalid order ID")
	ErrInvalidPrinterID     = errors.New("invalid printer ID")
)

type CreatePrinterRequest struct {
	Name     string  `json:"name"`
	Model    *string `json:"model,omitempty"`
	Material *string `json:"material,omitempty"`
	Status   string  `json:"status,omitempty"`
}

type UpdatePrinterRequest struct {
	Name     *string `json:"name,omitempty"`
	Model    *string `json:"model,omitempty"`
	Material *string `json:"material,omitempty"`
	Status   *string `json:"status,omitempty"`
}

type UpdatePrinterStatusRequest struct {
	Status string `json:"status"`
}
