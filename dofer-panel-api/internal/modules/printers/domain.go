package printers

import (
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
