package secret

import (
	"encoding/json"
	"errors"
	"fmt"
)

var ErrNoSecret = errors.New("The secret you requested do not exists")

type SecretManager struct {
	secret map[string]string
}

func (sm *SecretManager) Get(name string) (string, error) {
	secret, ok := sm.secret[name]
	if ok {
		return secret, nil
	}
	return "", ErrNoSecret
}

func Init(secretJson []byte) (*SecretManager, error) {
	var sm SecretManager
	err := json.Unmarshal(secretJson, &sm.secret)
	if err != nil {
		return nil, fmt.Errorf("secret init: %w", err)
	}
	return &sm, nil
}
