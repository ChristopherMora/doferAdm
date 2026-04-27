package domain

type UserRepository interface {
	FindByID(id string) (*User, error)
	FindByEmail(email string) (*User, error)
	Create(user *User) error
	Update(user *User) error
	// UpsertUser inserta el usuario si no existe, o no hace nada si ya existe.
	// Usado para sincronizar usuarios de Supabase a la DB local.
	UpsertUser(id, email, fullName string) error
	// ResolveOrganization obtiene la organizacion activa del usuario.
	// Si no se solicita una organizacion y el usuario no tiene membresia,
	// puede crear un workspace personal para beta.
	ResolveOrganization(userID, requestedOrganizationID string) (organizationID string, role string, err error)
}
