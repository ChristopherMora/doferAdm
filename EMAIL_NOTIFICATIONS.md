# Notificaciones por Email - DOFER Panel

## Estado Actual

✅ **Implementado:** Sistema de notificaciones por email automáticas

### Funcionalidad

Cuando se cambia el estado de una orden, el sistema:
1. Registra el cambio en el historial
2. Verifica si el cliente tiene email registrado
3. Envía automáticamente una notificación por email en segundo plano

### Modo de Desarrollo (Actual)

**ConsoleMailer** - Los emails se muestran en la consola del backend:

```
=== EMAIL NOTIFICATION ===
To: cliente@example.com
Subject: Actualización de tu orden ORD-20260109... - DOFER
---
Hola Juan Pérez,

Tu orden ORD-20260109... ha cambiado de estado a: En Impresión

Puedes seguir el estado de tu pedido en:
http://localhost:3000/track/a282f3ca-2ca8-4300-b914-8c42ef7c2c95

Gracias por tu confianza,
Equipo DOFER
==========================
```

### Para Producción

Para activar envío real de emails, configurar en `.env`:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password
SMTP_FROM=DOFER <noreply@dofer.com>
FRONTEND_URL=https://tudominio.com
```

Y cambiar en `router.go`:
```go
// En lugar de:
mailer := email.NewConsoleMailer()

// Usar:
mailer := email.NewSMTPMailer()
```

### Características

- ✅ Envío asíncrono (no bloquea la petición)
- ✅ Link directo al tracking público
- ✅ Estados traducidos al español
- ✅ Solo envía si el cliente tiene email
- ✅ Manejo de errores sin afectar el cambio de estado

### Probar

1. Crea una orden con un email válido
2. Cambia el estado de la orden desde el panel
3. Revisa la consola del backend (terminal donde corre el API)
4. Verás el email simulado

### Próximos Pasos (Opcional)

- [ ] Templates HTML para emails más profesionales
- [ ] Configurar SendGrid/Mailgun para producción
- [ ] Personalizar mensajes según el estado
- [ ] Agregar logo de DOFER en emails
- [ ] Sistema de preferencias de notificación
