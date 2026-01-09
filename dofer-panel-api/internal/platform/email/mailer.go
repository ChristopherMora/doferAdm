package email

import (
	"fmt"
	"os"
)

type Mailer interface {
	SendOrderStatusUpdate(to, customerName, orderNumber, status, trackingURL string) error
}

type ConsoleMailer struct{}

func NewConsoleMailer() *ConsoleMailer {
	return &ConsoleMailer{}
}

// SendOrderStatusUpdate simula el envío de email mostrándolo en consola
func (m *ConsoleMailer) SendOrderStatusUpdate(to, customerName, orderNumber, status, trackingURL string) error {
	fmt.Println("=== EMAIL NOTIFICATION ===")
	fmt.Printf("To: %s\n", to)
	fmt.Printf("Subject: Actualización de tu orden %s - DOFER\n", orderNumber)
	fmt.Println("---")
	fmt.Printf("Hola %s,\n\n", customerName)
	fmt.Printf("Tu orden %s ha cambiado de estado a: %s\n\n", orderNumber, getStatusInSpanish(status))
	fmt.Printf("Puedes seguir el estado de tu pedido en:\n%s\n\n", trackingURL)
	fmt.Println("Gracias por tu confianza,")
	fmt.Println("Equipo DOFER")
	fmt.Println("==========================")

	return nil
}

func getStatusInSpanish(status string) string {
	statusMap := map[string]string{
		"new":       "Nueva",
		"printing":  "En Impresión",
		"post":      "Post-procesamiento",
		"packed":    "Empacada",
		"ready":     "Lista para entrega",
		"delivered": "Entregada",
		"cancelled": "Cancelada",
	}

	if spanish, ok := statusMap[status]; ok {
		return spanish
	}
	return status
}

// SMTPMailer - Para producción (comentado por ahora)
type SMTPMailer struct {
	host     string
	port     int
	username string
	password string
	from     string
}

func NewSMTPMailer() *SMTPMailer {
	return &SMTPMailer{
		host:     os.Getenv("SMTP_HOST"),
		port:     587,
		username: os.Getenv("SMTP_USERNAME"),
		password: os.Getenv("SMTP_PASSWORD"),
		from:     os.Getenv("SMTP_FROM"),
	}
}

func (m *SMTPMailer) SendOrderStatusUpdate(to, customerName, orderNumber, status, trackingURL string) error {
	// TODO: Implementar envío real con net/smtp cuando se configure SMTP
	fmt.Printf("[SMTP] Would send email to %s for order %s\n", to, orderNumber)
	return nil
}
