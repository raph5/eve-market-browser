package secret

import (
	"encoding/json"
	"fmt"
	"log"
)

type SecretManager struct {
	secret map[string]string
}

func (sm *SecretManager) Get(name string) string {
	secret, ok := sm.secret[name]
	if !ok {
		log.Panicf("secret %s not available", name)
	}
	return secret
}

func Init(secretJson []byte) (*SecretManager, error) {
	var sm SecretManager
	err := json.Unmarshal(secretJson, &sm.secret)
	if err != nil {
		return nil, fmt.Errorf("secret init: %w", err)
	}
	return &sm, nil
}
