package diskStorage

import (
	"net/http"
	"os"
	"strings"
	"sync"
)

var storageRoot string
var storageIndex string
var filesMutex = make(map[string]*sync.RWMutex)
var filesMapMutex = &sync.RWMutex{}

func Init() error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	storageRoot = homeDir + "/.cache/emb/"
	storageIndex = homeDir + "/.cache/emb/__index.json"

	err = os.MkdirAll(storageRoot, 0755)
	if err != nil {
		return err
	}
	if _, err = os.Stat(storageIndex); err != nil {
		err = os.WriteFile(storageIndex, []byte("{}"), 0644)
		if err != nil {
			return err
		}
	}
	return nil
}

func GetFile(fileName string) string {
	return storageRoot + fileName
}

func Write(fileName string, data []byte) error {
	// create the directory if needed
	dirSeparator := strings.LastIndex(fileName, string(os.PathSeparator))
	if dirSeparator != -1 {
		dir := GetFile(fileName[:dirSeparator])
		err := os.MkdirAll(dir, 0755)
		if err != nil {
			return err
		}
	}

	// write the file
	filePath := GetFile(fileName)
	mutex := getFileMutex(fileName)
	mutex.Lock()
	err := os.WriteFile(filePath, data, 0644)
	mutex.Unlock()
	if err != nil {
		return err
	}
	return nil
}

func Read(fileName string) ([]byte, error) {
	filePath := GetFile(fileName)
	mutex := getFileMutex(fileName)
	mutex.RLock()
	file, err := os.ReadFile(filePath)
	mutex.RUnlock()
	return file, err
}

func Serve(w http.ResponseWriter, r *http.Request, fileName string) {
	mutex := getFileMutex(fileName)
	mutex.RLock()
	http.ServeFile(w, r, fileName)
	mutex.RUnlock()
}

func Exist(fileName string) bool {
	filePath := GetFile(fileName)
	_, err := os.Stat(filePath)
	return err == nil
}

func getFileMutex(fileName string) *sync.RWMutex {
	filesMapMutex.RLock()
	mutex, ok := filesMutex[fileName]
	filesMapMutex.RUnlock()
	if !ok {
		mutex = &sync.RWMutex{}
		filesMapMutex.Lock()
		filesMutex[fileName] = mutex
		filesMapMutex.Unlock()
	}
	return mutex
}
