package domain

type UserRepository interface {
	FindByID(id string) (*User, error)
	FindByEmail(email string) (*User, error)
	Create(user *User) error
	Update(user *User) error
	// UpsertUser inserta el usuario si no existe, o no hace nada si ya existe.
	// Usado para sincronizar usuarios de Supabase a la DB local.
	UpsertUser(id, email, fullName string) error
}
