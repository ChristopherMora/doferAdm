package domain

type UserRepository interface {
	FindByID(id string) (*User, error)
	FindByEmail(email string) (*User, error)
	Create(user *User) error
	Update(user *User) error
	ListOrganizationMembers(organizationID string) ([]OrganizationMember, error)
	InviteOrganizationMember(organizationID, email, fullName, role string) (*OrganizationMember, error)
	UpdateOrganizationMemberProfile(organizationID, userID, fullName string) (*OrganizationMember, error)
	UpdateOrganizationMemberRole(organizationID, userID, role string) error
	RemoveOrganizationMember(organizationID, userID string) error
	LogOrganizationAudit(organizationID, actorUserID, action, entityType, entityID string, metadata map[string]interface{}) error
	// UpsertUser sincroniza usuarios de Supabase a la DB local y devuelve el ID local efectivo.
	UpsertUser(id, email, fullName, role string) (string, error)
	// ResolveOrganization obtiene la organizacion activa del usuario.
	// Si no se solicita una organizacion y el usuario no tiene membresia,
	// puede crear un workspace personal para beta.
	ResolveOrganization(userID, requestedOrganizationID string) (organizationID string, role string, err error)
}
