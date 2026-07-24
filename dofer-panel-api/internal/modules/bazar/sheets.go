package bazar

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	sheetsScope = "https://www.googleapis.com/auth/spreadsheets"
	tokenURL    = "https://oauth2.googleapis.com/token"
	sheetsURL   = "https://sheets.googleapis.com/v4/spreadsheets"
)

type SheetsConfig struct {
	SpreadsheetID string
	ServiceEmail  string
	PrivateKey    string
	InventoryName string
	SalesName     string
	Timezone      string
}

type SheetsGateway interface {
	Configured() (bool, string)
	ReadProducts(context.Context) ([]sheetProduct, error)
	SyncSale(context.Context, *Sale, map[string]int) error
}

type GoogleSheetsClient struct {
	config      SheetsConfig
	httpClient  *http.Client
	mu          sync.Mutex
	accessToken string
	tokenExpiry time.Time
	location    *time.Location
}

func NewGoogleSheetsClient(config SheetsConfig) *GoogleSheetsClient {
	config.SpreadsheetID = strings.TrimSpace(config.SpreadsheetID)
	config.ServiceEmail = strings.TrimSpace(config.ServiceEmail)
	config.PrivateKey = strings.ReplaceAll(strings.TrimSpace(config.PrivateKey), `\n`, "\n")
	if strings.TrimSpace(config.InventoryName) == "" {
		config.InventoryName = "Inventario"
	}
	if strings.TrimSpace(config.SalesName) == "" {
		config.SalesName = "Ventas"
	}
	location, err := time.LoadLocation(strings.TrimSpace(config.Timezone))
	if err != nil {
		location, err = time.LoadLocation("America/Mexico_City")
	}
	if err != nil {
		location = time.UTC
	}
	return &GoogleSheetsClient{
		config:     config,
		httpClient: &http.Client{Timeout: 15 * time.Second},
		location:   location,
	}
}

func (c *GoogleSheetsClient) Configured() (bool, string) {
	missing := make([]string, 0, 3)
	if c.config.SpreadsheetID == "" {
		missing = append(missing, "GOOGLE_SHEETS_SPREADSHEET_ID")
	}
	if c.config.ServiceEmail == "" {
		missing = append(missing, "GOOGLE_SERVICE_ACCOUNT_EMAIL")
	}
	if c.config.PrivateKey == "" {
		missing = append(missing, "GOOGLE_PRIVATE_KEY")
	}
	if len(missing) > 0 {
		return false, "Faltan variables: " + strings.Join(missing, ", ")
	}
	return true, ""
}

func (c *GoogleSheetsClient) ReadProducts(ctx context.Context) ([]sheetProduct, error) {
	values, err := c.readRange(ctx, c.config.InventoryName, "A:Z")
	if err != nil {
		return nil, err
	}
	return parseInventoryRows(values)
}

func (c *GoogleSheetsClient) SyncSale(ctx context.Context, sale *Sale, stocks map[string]int) error {
	if sale == nil {
		return errors.New("missing sale")
	}
	if configured, message := c.Configured(); !configured {
		return errors.New(message)
	}

	inventoryRows, err := c.readRange(ctx, c.config.InventoryName, "A:Z")
	if err != nil {
		return fmt.Errorf("leer inventario: %w", err)
	}
	if err := c.updateInventoryStocks(ctx, inventoryRows, stocks); err != nil {
		return fmt.Errorf("actualizar inventario: %w", err)
	}

	salesRows, err := c.readRange(ctx, c.config.SalesName, "A:Z")
	if err != nil {
		return fmt.Errorf("leer ventas: %w", err)
	}

	if sale.Status == "cancelled" {
		updated, err := c.cancelExistingSaleRows(ctx, salesRows, sale.ExternalID)
		if err != nil {
			return fmt.Errorf("cancelar venta: %w", err)
		}
		if updated {
			return nil
		}
	}

	return c.appendMissingSaleRows(ctx, salesRows, sale)
}

func (c *GoogleSheetsClient) updateInventoryStocks(ctx context.Context, rows [][]any, stocks map[string]int) error {
	if len(stocks) == 0 {
		return nil
	}
	if len(rows) == 0 {
		return errors.New("la hoja Inventario no tiene encabezados")
	}

	headers := indexHeaders(rows[0])
	idColumn, ok := findHeader(headers, "id", "id producto", "sku", "codigo", "codigo interno")
	if !ok {
		return errors.New("falta la columna ID en Inventario")
	}
	stockColumn, ok := findHeader(headers, "stock", "existencia", "inventario")
	if !ok {
		return errors.New("falta la columna Stock en Inventario")
	}

	rowByID := make(map[string]int)
	for index, row := range rows[1:] {
		externalID := strings.TrimSpace(cellString(row, idColumn))
		if externalID != "" {
			rowByID[externalID] = index + 2
		}
	}

	data := make([]map[string]any, 0, len(stocks))
	for externalID, stock := range stocks {
		rowNumber, exists := rowByID[externalID]
		if !exists {
			return fmt.Errorf("producto %s no existe en Inventario", externalID)
		}
		data = append(data, map[string]any{
			"range":  sheetCellRange(c.config.InventoryName, stockColumn, rowNumber),
			"values": [][]any{{stock}},
		})
	}

	payload := map[string]any{
		"valueInputOption": "RAW",
		"data":             data,
	}
	return c.doJSON(ctx, http.MethodPost, c.spreadsheetEndpoint("/values:batchUpdate"), nil, payload, nil)
}

func (c *GoogleSheetsClient) cancelExistingSaleRows(ctx context.Context, rows [][]any, externalID string) (bool, error) {
	if len(rows) == 0 {
		return false, nil
	}
	headers := indexHeaders(rows[0])
	idColumn, idOK := findHeader(headers, "id venta", "sale id", "venta")
	statusColumn, statusOK := findHeader(headers, "estado", "status")
	if !idOK || !statusOK {
		return false, errors.New("faltan las columnas ID Venta o Estado en Ventas")
	}

	data := make([]map[string]any, 0)
	for index, row := range rows[1:] {
		if strings.TrimSpace(cellString(row, idColumn)) != externalID {
			continue
		}
		data = append(data, map[string]any{
			"range":  sheetCellRange(c.config.SalesName, statusColumn, index+2),
			"values": [][]any{{"Cancelada"}},
		})
	}
	if len(data) == 0 {
		return false, nil
	}

	payload := map[string]any{"valueInputOption": "RAW", "data": data}
	err := c.doJSON(ctx, http.MethodPost, c.spreadsheetEndpoint("/values:batchUpdate"), nil, payload, nil)
	return err == nil, err
}

func (c *GoogleSheetsClient) appendMissingSaleRows(ctx context.Context, existingRows [][]any, sale *Sale) error {
	existingItems := make(map[string]bool)
	if len(existingRows) > 0 {
		headers := indexHeaders(existingRows[0])
		idColumn, idOK := findHeader(headers, "id venta", "sale id", "venta")
		productColumn, productOK := findHeader(headers, "id producto", "product id", "sku")
		if idOK && productOK {
			for _, row := range existingRows[1:] {
				key := strings.TrimSpace(cellString(row, idColumn)) + "|" + strings.TrimSpace(cellString(row, productColumn))
				existingItems[key] = true
			}
		}
	}

	values := make([][]any, 0, len(sale.Items))
	status := "Completada"
	if sale.Status == "cancelled" {
		status = "Cancelada"
	}
	createdAt := sale.CreatedAt.In(c.location)
	for _, item := range sale.Items {
		if existingItems[sale.ExternalID+"|"+item.ProductExternalID] {
			continue
		}
		values = append(values, []any{
			sale.ExternalID,
			createdAt.Format("02/01/2006"),
			createdAt.Format("15:04:05"),
			item.ProductExternalID,
			item.ProductName,
			item.Quantity,
			item.UnitPrice,
			item.Total,
			sale.SellerName,
			sale.BazarName,
			paymentMethodLabel(sale.PaymentMethod),
			status,
			optionalString(sale.Notes),
			createdAt.Format(time.RFC3339),
		})
	}
	if len(values) == 0 {
		return nil
	}

	query := url.Values{
		"valueInputOption": {"USER_ENTERED"},
		"insertDataOption": {"INSERT_ROWS"},
	}
	endpoint := c.spreadsheetEndpoint(
		"/values/" + url.PathEscape(quoteSheetName(c.config.SalesName)+"!A:N") + ":append",
	)
	return c.doJSON(ctx, http.MethodPost, endpoint, query, map[string]any{"values": values}, nil)
}

func (c *GoogleSheetsClient) readRange(ctx context.Context, sheetName, columns string) ([][]any, error) {
	endpoint := c.spreadsheetEndpoint(
		"/values/" + url.PathEscape(quoteSheetName(sheetName)+"!"+columns),
	)
	query := url.Values{
		"majorDimension":    {"ROWS"},
		"valueRenderOption": {"UNFORMATTED_VALUE"},
	}
	var response struct {
		Values [][]any `json:"values"`
	}
	if err := c.doJSON(ctx, http.MethodGet, endpoint, query, nil, &response); err != nil {
		return nil, err
	}
	return response.Values, nil
}

func (c *GoogleSheetsClient) spreadsheetEndpoint(suffix string) string {
	return sheetsURL + "/" + url.PathEscape(c.config.SpreadsheetID) + suffix
}

func (c *GoogleSheetsClient) doJSON(
	ctx context.Context,
	method, endpoint string,
	query url.Values,
	body any,
	target any,
) error {
	token, err := c.token(ctx)
	if err != nil {
		return err
	}

	if len(query) > 0 {
		endpoint += "?" + query.Encode()
	}

	var requestBody io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		requestBody = bytes.NewReader(encoded)
	}

	request, err := http.NewRequestWithContext(ctx, method, endpoint, requestBody)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	response, err := c.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return fmt.Errorf("Google Sheets respondió %d: %s", response.StatusCode, strings.TrimSpace(string(message)))
	}
	if target == nil {
		_, _ = io.Copy(io.Discard, response.Body)
		return nil
	}
	return json.NewDecoder(response.Body).Decode(target)
}

func (c *GoogleSheetsClient) token(ctx context.Context) (string, error) {
	if configured, message := c.Configured(); !configured {
		return "", errors.New(message)
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	if c.accessToken != "" && time.Now().Add(30*time.Second).Before(c.tokenExpiry) {
		return c.accessToken, nil
	}

	assertion, err := c.signedAssertion()
	if err != nil {
		return "", err
	}
	form := url.Values{
		"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"},
		"assertion":  {assertion},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	response, err := c.httpClient.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return "", fmt.Errorf("Google OAuth respondió %d: %s", response.StatusCode, strings.TrimSpace(string(message)))
	}

	var payload struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return "", err
	}
	if payload.AccessToken == "" {
		return "", errors.New("Google OAuth no devolvió un token")
	}
	if payload.ExpiresIn <= 0 {
		payload.ExpiresIn = 3600
	}
	c.accessToken = payload.AccessToken
	c.tokenExpiry = time.Now().Add(time.Duration(payload.ExpiresIn) * time.Second)
	return c.accessToken, nil
}

func (c *GoogleSheetsClient) signedAssertion() (string, error) {
	block, _ := pem.Decode([]byte(c.config.PrivateKey))
	if block == nil {
		return "", errors.New("GOOGLE_PRIVATE_KEY no contiene una clave PEM válida")
	}

	var privateKey *rsa.PrivateKey
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err == nil {
		var ok bool
		privateKey, ok = key.(*rsa.PrivateKey)
		if !ok {
			return "", errors.New("GOOGLE_PRIVATE_KEY no es una clave RSA")
		}
	} else {
		privateKey, err = x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return "", fmt.Errorf("leer GOOGLE_PRIVATE_KEY: %w", err)
		}
	}

	now := time.Now().Unix()
	header, _ := json.Marshal(map[string]string{"alg": "RS256", "typ": "JWT"})
	claims, _ := json.Marshal(map[string]any{
		"iss":   c.config.ServiceEmail,
		"scope": sheetsScope,
		"aud":   tokenURL,
		"iat":   now,
		"exp":   now + 3600,
	})
	encodedHeader := base64.RawURLEncoding.EncodeToString(header)
	encodedClaims := base64.RawURLEncoding.EncodeToString(claims)
	unsigned := encodedHeader + "." + encodedClaims
	digest := sha256.Sum256([]byte(unsigned))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	return unsigned + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func parseInventoryRows(rows [][]any) ([]sheetProduct, error) {
	if len(rows) == 0 {
		return nil, errors.New("la hoja Inventario está vacía")
	}

	headers := indexHeaders(rows[0])
	idColumn, ok := findHeader(headers, "id", "id producto", "sku", "codigo", "codigo interno")
	if !ok {
		return nil, errors.New("falta la columna ID en Inventario")
	}
	nameColumn, ok := findHeader(headers, "producto", "nombre", "product")
	if !ok {
		return nil, errors.New("falta la columna Producto en Inventario")
	}
	priceColumn, ok := findHeader(headers, "precio", "price")
	if !ok {
		return nil, errors.New("falta la columna Precio en Inventario")
	}
	stockColumn, ok := findHeader(headers, "stock", "existencia", "inventario")
	if !ok {
		return nil, errors.New("falta la columna Stock en Inventario")
	}
	categoryColumn, _ := findHeader(headers, "categoria", "category", "coleccion")
	costColumn, _ := findHeader(headers, "costo", "cost")
	imageColumn, _ := findHeader(headers, "imagen", "image", "image url", "url")
	activeColumn, hasActive := findHeader(headers, "activo", "active")

	products := make([]sheetProduct, 0, len(rows)-1)
	for index, row := range rows[1:] {
		externalID := strings.TrimSpace(cellString(row, idColumn))
		name := strings.TrimSpace(cellString(row, nameColumn))
		if externalID == "" && name == "" {
			continue
		}
		if externalID == "" || name == "" {
			return nil, fmt.Errorf("fila %d: ID y Producto son obligatorios", index+2)
		}

		price, err := cellFloat(row, priceColumn)
		if err != nil || price < 0 {
			return nil, fmt.Errorf("fila %d: Precio inválido", index+2)
		}
		stockValue, err := cellFloat(row, stockColumn)
		if err != nil || stockValue < 0 || stockValue != float64(int(stockValue)) {
			return nil, fmt.Errorf("fila %d: Stock inválido", index+2)
		}

		var cost *float64
		if cellString(row, costColumn) != "" {
			value, err := cellFloat(row, costColumn)
			if err != nil || value < 0 {
				return nil, fmt.Errorf("fila %d: Costo inválido", index+2)
			}
			cost = &value
		}
		var imageURL *string
		if value := strings.TrimSpace(cellString(row, imageColumn)); value != "" {
			imageURL = &value
		}

		active := true
		if hasActive {
			active = cellBool(row, activeColumn)
		}
		products = append(products, sheetProduct{
			ExternalID: externalID,
			Name:       name,
			Category:   strings.TrimSpace(cellString(row, categoryColumn)),
			Price:      price,
			Cost:       cost,
			Stock:      int(stockValue),
			ImageURL:   imageURL,
			Active:     active,
			SheetRow:   index + 2,
		})
	}
	return products, nil
}

func indexHeaders(row []any) map[string]int {
	headers := make(map[string]int)
	for index, value := range row {
		normalized := normalizeHeader(fmt.Sprint(value))
		if normalized != "" {
			headers[normalized] = index
		}
	}
	return headers
}

func findHeader(headers map[string]int, aliases ...string) (int, bool) {
	for _, alias := range aliases {
		if index, ok := headers[normalizeHeader(alias)]; ok {
			return index, true
		}
	}
	return -1, false
}

func normalizeHeader(value string) string {
	replacer := strings.NewReplacer(
		"á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u", "ü", "u", "ñ", "n",
		"Á", "a", "É", "e", "Í", "i", "Ó", "o", "Ú", "u", "Ü", "u", "Ñ", "n",
		"_", " ", "-", " ",
	)
	return strings.Join(strings.Fields(strings.ToLower(replacer.Replace(strings.TrimSpace(value)))), " ")
}

func cellString(row []any, index int) string {
	if index < 0 || index >= len(row) || row[index] == nil {
		return ""
	}
	switch value := row[index].(type) {
	case string:
		return strings.TrimSpace(value)
	case float64:
		if value == float64(int64(value)) {
			return strconv.FormatInt(int64(value), 10)
		}
		return strconv.FormatFloat(value, 'f', -1, 64)
	default:
		return strings.TrimSpace(fmt.Sprint(value))
	}
}

func cellFloat(row []any, index int) (float64, error) {
	if index < 0 || index >= len(row) || row[index] == nil {
		return 0, nil
	}
	switch value := row[index].(type) {
	case float64:
		return value, nil
	case int:
		return float64(value), nil
	case json.Number:
		return value.Float64()
	default:
		normalized := strings.NewReplacer("$", "", ",", "", " ", "").Replace(fmt.Sprint(value))
		return strconv.ParseFloat(normalized, 64)
	}
}

func cellBool(row []any, index int) bool {
	value := normalizeHeader(cellString(row, index))
	switch value {
	case "", "si", "yes", "true", "1", "activo", "active":
		return true
	default:
		return false
	}
}

func sheetCellRange(sheetName string, zeroBasedColumn, row int) string {
	return fmt.Sprintf("%s!%s%d", quoteSheetName(sheetName), columnName(zeroBasedColumn), row)
}

func quoteSheetName(name string) string {
	return "'" + strings.ReplaceAll(name, "'", "''") + "'"
}

func columnName(index int) string {
	if index < 0 {
		return "A"
	}
	result := ""
	for index >= 0 {
		result = string(rune('A'+index%26)) + result
		index = index/26 - 1
	}
	return result
}

func optionalString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func paymentMethodLabel(method string) string {
	switch method {
	case PaymentTransfer:
		return "Transferencia"
	case PaymentCard:
		return "Tarjeta"
	case PaymentMercadoPago:
		return "Mercado Pago"
	case PaymentOther:
		return "Otro"
	default:
		return "Efectivo"
	}
}
