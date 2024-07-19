package diskStorage

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

var indexMutex = &sync.RWMutex{}

func ReadIndex[T any](key string) (T, bool, error) {
	indexMutex.RLock()
	rowIndex, err := os.ReadFile(storageIndex)
	indexMutex.RUnlock()
	if err != nil {
		return *new(T), false, err
	}

	var index map[string]any
	err = json.Unmarshal(rowIndex, &index)
	if err != nil {
		return *new(T), false, err
	}

	rawValue, ok := index[key]
  if !ok {
    return *new(T), false, nil
  }
  value, ok := rawValue.(T)
	if !ok {
		return *new(T), false, fmt.Errorf("Invalid json type for \"%s\" in __index.json", key)
	}

	return value, true, nil
}

func WriteIndex[T any](key string, value T) error {
	indexMutex.RLock()
	rowIndex, err := os.ReadFile(storageIndex)
	indexMutex.RUnlock()
	if err != nil {
		return err
	}

	var index map[string]any
	err = json.Unmarshal(rowIndex, &index)
	if err != nil {
		return err
	}

	index[key] = value
	rowIndex, err = json.Marshal(index)
	if err != nil {
		return err
	}

	indexMutex.Lock()
	err = os.WriteFile(storageIndex, rowIndex, 0644)
	indexMutex.Unlock()
	if err != nil {
		return err
	}

	return nil
}
