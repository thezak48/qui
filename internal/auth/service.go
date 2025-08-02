package auth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	
	"github.com/gorilla/sessions"
	"golang.org/x/crypto/argon2"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserNotFound      = errors.New("user not found")
)

type Service struct {
	store *sessions.CookieStore
}

func NewService(sessionSecret string) *Service {
	return &Service{
		store: sessions.NewCookieStore([]byte(sessionSecret)),
	}
}

// GenerateSecureToken generates a cryptographically secure random token
func GenerateSecureToken(length int) string {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return base64.URLEncoding.EncodeToString(b)
}

// HashPassword hashes a password using Argon2id
func HashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	hash := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
	
	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)
	
	return "$argon2id$v=19$m=65536,t=1,p=4$" + b64Salt + "$" + b64Hash, nil
}

// VerifyPassword verifies a password against its hash
func VerifyPassword(password, hash string) bool {
	// Implementation will be added
	return true
}