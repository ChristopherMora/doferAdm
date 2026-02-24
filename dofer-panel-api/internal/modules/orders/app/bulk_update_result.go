package app

type BulkUpdateOrderError struct {
	OrderID string `json:"order_id"`
	Error   string `json:"error"`
}

type BulkUpdateOrdersResult struct {
	BatchID   string                 `json:"batch_id"`
	Requested int                    `json:"requested"`
	Updated   int                    `json:"updated"`
	Skipped   int                    `json:"skipped"`
	Failed    int                    `json:"failed"`
	Errors    []BulkUpdateOrderError `json:"errors,omitempty"`
}
