package infra

import (
	"context"
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

// UpsertUser inserta el usuario si no existe. Si ya existe, no hace nada.
// El role por defecto es 'operator'; un admin puede cambiarlo después.
func (r *PostgresUserRepository) UpsertUser(id, email, fullName string) error {
	query := `
		INSERT INTO users (id, email, full_name, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'operator', NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`
	if fullName == "" {
		fullName = email
	}
	_, err := r.db.Exec(context.Background(), query, id, email, fullName)
	return err
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
