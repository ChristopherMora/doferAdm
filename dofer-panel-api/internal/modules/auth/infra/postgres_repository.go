package infra

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/dofer/panel-api/internal/modules/auth/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresUserRepository struct {
	db *pgxpool.Pool
}

func NewPostgresUserRepository(db *pgxpool.Pool) *PostgresUserRepository {
	return &PostgresUserRepository{db: db}
}

func (r *PostgresUserRepository) FindByID(id string) (*domain.User, error) {
	query := `
		SELECT id, email, full_name, role, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var user domain.User
	err := r.db.QueryRow(context.Background(), query, id).Scan(
		&user.ID,
		&user.Email,
		&user.FullName,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	return &user, nil
}

func (r *PostgresUserRepository) FindByEmail(email string) (*domain.User, error) {
	query := `
		SELECT id, email, full_name, role, created_at, updated_at
		FROM users
		WHERE email = $1
	`

	var user domain.User
	err := r.db.QueryRow(context.Background(), query, email).Scan(
		&user.ID,
		&user.Email,
		&user.FullName,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	return &user, nil
}

func (r *PostgresUserRepository) Create(user *domain.User) error {
	query := `
		INSERT INTO users (id, email, full_name, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := r.db.Exec(
		context.Background(),
		query,
		user.ID,
		user.Email,
		user.FullName,
		user.Role,
		user.CreatedAt,
		user.UpdatedAt,
	)

	return err
}

const defaultOrganizationID = "00000000-0000-0000-0000-000000000001"

// UpsertUser sincroniza el usuario de Supabase con el usuario local.
// Si ya existe un usuario local con el mismo email, conserva su ID local y
// enlaza el subject de Supabase en auth_user_id.
func (r *PostgresUserRepository) UpsertUser(id, email, fullName, role string) (string, error) {
	ctx := context.Background()
	id = strings.TrimSpace(id)
	email = strings.TrimSpace(email)
	role = normalizeRole(role)
	if id == "" {
		return "", errors.New("user ID is required")
	}
	if email == "" {
		email = id + "@unknown.local"
	}
	if fullName == "" {
		fullName = email
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	localUserID, err := r.findOrCreateSyncedUser(ctx, tx, id, email, fullName, role)
	if err != nil {
		return "", err
	}

	if err := r.ensureDefaultOrganizationMembership(ctx, tx, localUserID); err != nil {
		return "", err
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}

	return localUserID, nil
}

func (r *PostgresUserRepository) findOrCreateSyncedUser(ctx context.Context, tx pgx.Tx, authUserID, email, fullName, role string) (string, error) {
	var localUserID string
	err := tx.QueryRow(ctx, `
		SELECT id::text
		FROM users
		WHERE id = $1 OR auth_user_id = $1
		LIMIT 1
	`, authUserID).Scan(&localUserID)
	if err == nil {
		_, err = tx.Exec(ctx, `
			UPDATE users
			SET email = $2,
			    full_name = COALESCE(NULLIF($3, ''), full_name),
			    auth_user_id = COALESCE(auth_user_id, $1),
			    updated_at = NOW()
			WHERE id = $4
		`, authUserID, email, fullName, localUserID)
		return localUserID, err
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	err = tx.QueryRow(ctx, `
		SELECT id::text
		FROM users
		WHERE lower(email) = lower($1)
		LIMIT 1
	`, email).Scan(&localUserID)
	if err == nil {
		_, err = tx.Exec(ctx, `
			UPDATE users
			SET full_name = COALESCE(NULLIF($2, ''), full_name),
			    auth_user_id = $3,
			    updated_at = NOW()
			WHERE id = $1
		`, localUserID, fullName, authUserID)
		return localUserID, err
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO users (id, auth_user_id, email, full_name, role, created_at, updated_at)
		VALUES ($1, $1, $2, $3, $4, NOW(), NOW())
		RETURNING id::text
	`, authUserID, email, fullName, role).Scan(&localUserID)
	if err != nil {
		return "", err
	}

	return localUserID, nil
}

func (r *PostgresUserRepository) ensureDefaultOrganizationMembership(ctx context.Context, tx pgx.Tx, userID string) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO organizations (id, name, slug, created_by)
		VALUES ($1, 'DOFER', 'dofer', NULL)
		ON CONFLICT (id) DO UPDATE
		SET name = EXCLUDED.name,
		    slug = EXCLUDED.slug,
		    updated_at = NOW()
	`, defaultOrganizationID)
	if err != nil {
		return err
	}

	var membershipCount int
	err = tx.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM organization_members
		WHERE organization_id = $1
	`, defaultOrganizationID).Scan(&membershipCount)
	if err != nil {
		return err
	}

	role := "operator"
	err = tx.QueryRow(ctx, `
		SELECT CASE WHEN role IN ('admin', 'operator', 'viewer') THEN role ELSE 'operator' END
		FROM users
		WHERE id = $1
	`, userID).Scan(&role)
	if err != nil {
		return err
	}
	if membershipCount == 0 {
		role = "admin"
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO organization_members (organization_id, user_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (organization_id, user_id) DO NOTHING
	`, defaultOrganizationID, userID, role)
	return err
}

func normalizeRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "admin", "operator", "viewer":
		return strings.ToLower(strings.TrimSpace(role))
	default:
		return "operator"
	}
}

func (r *PostgresUserRepository) ResolveOrganization(userID, requestedOrganizationID string) (string, string, error) {
	ctx := context.Background()
	userID = strings.TrimSpace(userID)
	requestedOrganizationID = strings.TrimSpace(requestedOrganizationID)
	if userID == "" {
		return "", "", errors.New("user ID is required")
	}

	if requestedOrganizationID != "" {
		var organizationID, role string
		err := r.db.QueryRow(ctx, `
			SELECT organization_id::text, role
			FROM organization_members
			WHERE user_id = $1 AND organization_id = $2
		`, userID, requestedOrganizationID).Scan(&organizationID, &role)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return "", "", errors.New("organization membership not found")
			}
			return "", "", err
		}
		return organizationID, role, nil
	}

	var organizationID, role string
	err := r.db.QueryRow(ctx, `
		SELECT organization_id::text, role
		FROM organization_members
		WHERE user_id = $1
		ORDER BY created_at ASC
		LIMIT 1
	`, userID).Scan(&organizationID, &role)
	if err == nil {
		return organizationID, role, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", "", err
	}

	return r.createPersonalOrganization(ctx, userID)
}

func (r *PostgresUserRepository) createPersonalOrganization(ctx context.Context, userID string) (string, string, error) {
	var email, fullName string
	err := r.db.QueryRow(ctx, `
		SELECT email, COALESCE(NULLIF(full_name, ''), email)
		FROM users
		WHERE id = $1
	`, userID).Scan(&email, &fullName)
	if err != nil {
		return "", "", err
	}

	name := strings.TrimSpace(fullName)
	if name == "" {
		name = strings.TrimSpace(email)
	}
	if name == "" {
		name = "Workspace"
	}
	orgName := fmt.Sprintf("%s Workspace", name)
	orgSlug := makeOrganizationSlug(email, userID)

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback(ctx)

	var organizationID string
	err = tx.QueryRow(ctx, `
		INSERT INTO organizations (name, slug, created_by)
		VALUES ($1, $2, $3)
		RETURNING id::text
	`, orgName, orgSlug, userID).Scan(&organizationID)
	if err != nil {
		return "", "", err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO organization_members (organization_id, user_id, role)
		VALUES ($1, $2, 'admin')
		ON CONFLICT (organization_id, user_id) DO NOTHING
	`, organizationID, userID)
	if err != nil {
		return "", "", err
	}

	if err := tx.Commit(ctx); err != nil {
		return "", "", err
	}

	return organizationID, "admin", nil
}

func makeOrganizationSlug(email, userID string) string {
	base := strings.TrimSpace(email)
	if at := strings.Index(base, "@"); at > 0 {
		base = base[:at]
	}
	base = strings.ToLower(base)
	base = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(base, "-")
	base = strings.Trim(base, "-")
	if base == "" {
		base = "workspace"
	}

	suffix := strings.ReplaceAll(userID, "-", "")
	if len(suffix) < 8 {
		suffix = strings.ReplaceAll(uuid.NewString(), "-", "")
	}
	return fmt.Sprintf("%s-%s", base, suffix[:8])
}

func (r *PostgresUserRepository) Update(user *domain.User) error {
	query := `
		UPDATE users
		SET full_name = $2, role = $3, updated_at = $4
		WHERE id = $1
	`

	_, err := r.db.Exec(
		context.Background(),
		query,
		user.ID,
		user.FullName,
		user.Role,
		user.UpdatedAt,
	)

	return err
}

func (r *PostgresUserRepository) ListOrganizationMembers(organizationID string) ([]domain.OrganizationMember, error) {
	organizationID = strings.TrimSpace(organizationID)
	if organizationID == "" {
		return nil, errors.New("organization ID is required")
	}

	rows, err := r.db.Query(context.Background(), `
		WITH admin_totals AS (
			SELECT COUNT(*) AS admins
			FROM organization_members
			WHERE organization_id = $1 AND role = 'admin'
		),
		order_metrics AS (
			SELECT
				assigned_to AS user_id,
				COUNT(*) AS assigned_orders,
				COUNT(*) FILTER (WHERE status NOT IN ('delivered', 'cancelled')) AS active_orders,
				COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_orders,
				MAX(updated_at) AS last_order_activity_at
			FROM orders
			WHERE organization_id = $1
			  AND assigned_to IS NOT NULL
			GROUP BY assigned_to
		),
		time_metrics AS (
			SELECT
				operator_id AS user_id,
				COALESCE(SUM(duration_minutes), 0) AS total_minutes,
				MAX(COALESCE(ended_at, started_at, created_at)) AS last_timer_activity_at
			FROM order_time_entries
			WHERE organization_id = $1
			  AND operator_id IS NOT NULL
			GROUP BY operator_id
		),
		audit_metrics AS (
			SELECT
				actor_user_id AS user_id,
				MAX(created_at) AS last_audit_activity_at
			FROM organization_audit_logs
			WHERE organization_id = $1
			  AND actor_user_id IS NOT NULL
			GROUP BY actor_user_id
		)
		SELECT
			u.id::text,
			u.email,
			COALESCE(u.full_name, ''),
			u.role,
			om.organization_id::text,
			om.role,
			om.created_at,
			om.updated_at,
			u.created_at,
			u.updated_at,
			u.auth_user_id IS NOT NULL AS auth_linked,
			(om.role = 'admin' AND admin_totals.admins = 1) AS is_last_admin,
			COALESCE(order_metrics.assigned_orders, 0) AS assigned_orders,
			COALESCE(order_metrics.active_orders, 0) AS active_orders,
			COALESCE(order_metrics.delivered_orders, 0) AS delivered_orders,
			COALESCE(time_metrics.total_minutes, 0) AS total_minutes,
			GREATEST(
				u.updated_at,
				om.updated_at,
				COALESCE(order_metrics.last_order_activity_at, om.updated_at),
				COALESCE(time_metrics.last_timer_activity_at, om.updated_at),
				COALESCE(audit_metrics.last_audit_activity_at, om.updated_at)
			) AS last_activity_at
		FROM organization_members om
		INNER JOIN users u ON u.id = om.user_id
		CROSS JOIN admin_totals
		LEFT JOIN order_metrics ON order_metrics.user_id = u.id
		LEFT JOIN time_metrics ON time_metrics.user_id = u.id
		LEFT JOIN audit_metrics ON audit_metrics.user_id = u.id
		WHERE om.organization_id = $1
		ORDER BY
			CASE om.role
				WHEN 'admin' THEN 1
				WHEN 'operator' THEN 2
				ELSE 3
			END,
			lower(u.email)
	`, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := make([]domain.OrganizationMember, 0)
	for rows.Next() {
		var member domain.OrganizationMember
		var userRole, organizationRole string
		var lastActivityAt sql.NullTime
		if err := rows.Scan(
			&member.UserID,
			&member.Email,
			&member.FullName,
			&userRole,
			&member.OrganizationID,
			&organizationRole,
			&member.MembershipCreatedAt,
			&member.MembershipUpdatedAt,
			&member.AccountCreatedAt,
			&member.AccountUpdatedAt,
			&member.AuthLinked,
			&member.IsLastAdmin,
			&member.AssignedOrders,
			&member.ActiveOrders,
			&member.DeliveredOrders,
			&member.TotalMinutes,
			&lastActivityAt,
		); err != nil {
			return nil, err
		}
		member.UserRole = domain.Role(userRole)
		member.OrganizationRole = domain.Role(organizationRole)
		if lastActivityAt.Valid {
			lastActivity := lastActivityAt.Time
			member.LastActivityAt = &lastActivity
		}
		members = append(members, member)
	}

	return members, rows.Err()
}

func (r *PostgresUserRepository) InviteOrganizationMember(organizationID, email, fullName, role string) (*domain.OrganizationMember, error) {
	organizationID = strings.TrimSpace(organizationID)
	email = strings.ToLower(strings.TrimSpace(email))
	fullName = strings.TrimSpace(fullName)
	role = strings.ToLower(strings.TrimSpace(role))
	if organizationID == "" {
		return nil, errors.New("organization ID is required")
	}
	if email == "" || !strings.Contains(email, "@") {
		return nil, errors.New("valid email is required")
	}
	if fullName == "" {
		fullName = email
	}
	if !isValidRole(role) {
		return nil, errors.New("invalid role")
	}

	ctx := context.Background()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var userID string
	err = tx.QueryRow(ctx, `
		SELECT id::text
		FROM users
		WHERE lower(email) = lower($1)
		LIMIT 1
	`, email).Scan(&userID)
	if err == nil {
		_, err = tx.Exec(ctx, `
			UPDATE users
			SET full_name = COALESCE(NULLIF($2, ''), full_name),
			    role = $3,
			    updated_at = NOW()
			WHERE id = $1
		`, userID, fullName, role)
		if err != nil {
			return nil, err
		}
	} else if errors.Is(err, pgx.ErrNoRows) {
		userID = uuid.NewString()
		err = tx.QueryRow(ctx, `
			INSERT INTO users (id, email, full_name, role, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW())
			RETURNING id::text
		`, userID, email, fullName, role).Scan(&userID)
		if err != nil {
			return nil, err
		}
	} else {
		return nil, err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO organization_members (organization_id, user_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (organization_id, user_id) DO UPDATE
		SET role = EXCLUDED.role,
		    updated_at = NOW()
	`, organizationID, userID, role)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	members, err := r.ListOrganizationMembers(organizationID)
	if err != nil {
		return nil, err
	}
	for _, member := range members {
		if member.UserID == userID {
			return &member, nil
		}
	}

	return nil, errors.New("organization member not found")
}

func (r *PostgresUserRepository) UpdateOrganizationMemberProfile(organizationID, userID, fullName string) (*domain.OrganizationMember, error) {
	organizationID = strings.TrimSpace(organizationID)
	userID = strings.TrimSpace(userID)
	fullName = strings.TrimSpace(fullName)
	if organizationID == "" {
		return nil, errors.New("organization ID is required")
	}
	if userID == "" {
		return nil, errors.New("user ID is required")
	}
	if fullName == "" {
		return nil, errors.New("full name is required")
	}

	ctx := context.Background()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var exists bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM organization_members
			WHERE organization_id = $1 AND user_id = $2
		)
	`, organizationID, userID).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, errors.New("organization member not found")
	}

	_, err = tx.Exec(ctx, `
		UPDATE users
		SET full_name = $2,
		    updated_at = NOW()
		WHERE id = $1
	`, userID, fullName)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(ctx, `
		UPDATE organization_members
		SET updated_at = NOW()
		WHERE organization_id = $1 AND user_id = $2
	`, organizationID, userID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	members, err := r.ListOrganizationMembers(organizationID)
	if err != nil {
		return nil, err
	}
	for _, member := range members {
		if member.UserID == userID {
			return &member, nil
		}
	}

	return nil, errors.New("organization member not found")
}

func (r *PostgresUserRepository) UpdateOrganizationMemberRole(organizationID, userID, role string) error {
	organizationID = strings.TrimSpace(organizationID)
	userID = strings.TrimSpace(userID)
	role = strings.ToLower(strings.TrimSpace(role))
	if organizationID == "" {
		return errors.New("organization ID is required")
	}
	if userID == "" {
		return errors.New("user ID is required")
	}
	if !isValidRole(role) {
		return errors.New("invalid role")
	}

	ctx := context.Background()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var currentRole string
	err = tx.QueryRow(ctx, `
		SELECT role
		FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
		FOR UPDATE
	`, organizationID, userID).Scan(&currentRole)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("organization member not found")
		}
		return err
	}

	if currentRole == "admin" && role != "admin" {
		var otherAdmins int
		err = tx.QueryRow(ctx, `
			SELECT COUNT(*)
			FROM organization_members
			WHERE organization_id = $1
			  AND user_id <> $2
			  AND role = 'admin'
		`, organizationID, userID).Scan(&otherAdmins)
		if err != nil {
			return err
		}
		if otherAdmins == 0 {
			return errors.New("organization must keep at least one admin")
		}
	}

	_, err = tx.Exec(ctx, `
		UPDATE organization_members
		SET role = $3,
		    updated_at = NOW()
		WHERE organization_id = $1 AND user_id = $2
	`, organizationID, userID, role)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		UPDATE users
		SET role = $2,
		    updated_at = NOW()
		WHERE id = $1
	`, userID, role)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *PostgresUserRepository) RemoveOrganizationMember(organizationID, userID string) error {
	organizationID = strings.TrimSpace(organizationID)
	userID = strings.TrimSpace(userID)
	if organizationID == "" {
		return errors.New("organization ID is required")
	}
	if userID == "" {
		return errors.New("user ID is required")
	}

	ctx := context.Background()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var currentRole string
	err = tx.QueryRow(ctx, `
		SELECT role
		FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
		FOR UPDATE
	`, organizationID, userID).Scan(&currentRole)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("organization member not found")
		}
		return err
	}

	if currentRole == "admin" {
		var otherAdmins int
		err = tx.QueryRow(ctx, `
			SELECT COUNT(*)
			FROM organization_members
			WHERE organization_id = $1
			  AND user_id <> $2
			  AND role = 'admin'
		`, organizationID, userID).Scan(&otherAdmins)
		if err != nil {
			return err
		}
		if otherAdmins == 0 {
			return errors.New("organization must keep at least one admin")
		}
	}

	_, err = tx.Exec(ctx, `
		DELETE FROM organization_members
		WHERE organization_id = $1 AND user_id = $2
	`, organizationID, userID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *PostgresUserRepository) LogOrganizationAudit(organizationID, actorUserID, action, entityType, entityID string, metadata map[string]interface{}) error {
	organizationID = strings.TrimSpace(organizationID)
	actorUserID = strings.TrimSpace(actorUserID)
	action = strings.TrimSpace(action)
	entityType = strings.TrimSpace(entityType)
	entityID = strings.TrimSpace(entityID)
	if organizationID == "" || action == "" || entityType == "" {
		return errors.New("audit log requires organization, action and entity type")
	}
	if metadata == nil {
		metadata = map[string]interface{}{}
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return err
	}

	var actor interface{}
	if isUUID(actorUserID) {
		actor = actorUserID
	}

	_, err = r.db.Exec(context.Background(), `
		INSERT INTO organization_audit_logs (
			organization_id, actor_user_id, action, entity_type, entity_id, metadata
		) VALUES ($1, $2, $3, $4, $5, $6)
	`, organizationID, actor, action, entityType, entityID, metadataJSON)
	return err
}

func isUUID(value string) bool {
	return regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`).MatchString(value)
}

func isValidRole(role string) bool {
	switch role {
	case "admin", "operator", "viewer":
		return true
	default:
		return false
	}
}
