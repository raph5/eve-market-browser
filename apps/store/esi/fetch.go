package esi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"
)

type EsiError struct {
	Message string
	Code    int
}

type jsonTimeoutError struct {
  Error string `json:"error"`
  Timeout int  `json:"timeout"`
}
type jsonError struct {
  Error string `json:"error"`
}

const esiUrl = "https://esi.evetech.net/latest"
const EsiDateLayout = "2006-01-02"

var ErrNoTriesLeft = errors.New("Failed 5 esi fetching attempts")

var semaphore = make(chan struct{}, 5)
var apiTimeout int64
var apiTimeoutMu sync.RWMutex

func EsiFetch[T any](uri string, method string, query map[string]string, body any, tries int) (T, error) {
  // if no tries left, fail the request
  if tries <= 0 {
    return *new(T), ErrNoTriesLeft
  }

  // require premission from the semaphore
  semaphore <- struct{}{}

  // wait for the api to be clear of any timeout
  for {
    now := time.Now().Unix()
    apiTimeoutMu.RLock()
    timeToWait := apiTimeout - now
    apiTimeoutMu.RUnlock()
    if timeToWait <= 0 {
      break
    }
    time.Sleep(time.Duration(timeToWait) * time.Second)
  }

  // create the request
	var serializedBody []byte
	if method == "POST" || method == "PUT" {
		var err error
		serializedBody, err = json.Marshal(body)
		if err != nil {
			return *new(T), err
		}
	}

	u, err := url.Parse(esiUrl + uri)
	if err != nil {
		return *new(T), err
	}
	q := u.Query()
	for key, value := range query {
		q.Set(key, value)
	}
	u.RawQuery = q.Encode()
	finalUrl := u.String()

	request, err := http.NewRequest(method, finalUrl, bytes.NewBuffer(serializedBody))
	if err != nil {
		return *new(T), err
	}
	request.Header.Set("content-type", "application/json")
	request.Header.Set("User-Agent", "evemarketbrowser.com - contact me at raphguyader@gmail.com")

  // run the request
	client := &http.Client{}

  var response *http.Response
  response, err = client.Do(request)
  <- semaphore  // release semaphore
  if err != nil {
    retryData, retryErr := EsiFetch[T](uri, method, query, body, tries-1)
    if errors.Is(retryErr, ErrNoTriesLeft) {
      return *new(T), err
    }
    return retryData, retryErr
  }
  defer response.Body.Close()

  decoder := json.NewDecoder(response.Body)
  decoder.UseNumber()

  if response.StatusCode == 503 || response.StatusCode == 420 {
    log.Printf("ESI timeout %d", response.StatusCode)
    apiTimeoutMu.Lock()
    apiTimeout = time.Now().Unix() + 5
    apiTimeoutMu.Unlock()
    retryData, retryErr := EsiFetch[T](uri, method, query, body, tries-1)
    if errors.Is(retryErr, ErrNoTriesLeft) {
      return *new(T), err
    }
    return retryData, retryErr
  }

  if response.StatusCode == 504 {
    log.Printf("ESI timeout %d", response.StatusCode)
    var error jsonTimeoutError
    err = decoder.Decode(&error)
    if err == nil {
      apiTimeoutMu.Lock()
      apiTimeout = time.Now().Unix() + int64(error.Timeout)
      apiTimeoutMu.Unlock()
    }
    retryData, retryErr := EsiFetch[T](uri, method, query, body, tries-1)
    if errors.Is(retryErr, ErrNoTriesLeft) {
      return *new(T), err
    }
    return retryData, retryErr
  }

  if response.StatusCode != 200 {
    var error jsonError
    err = decoder.Decode(&error)
    if err != nil {
      retryData, retryErr := EsiFetch[T](uri, method, query, body, tries-1)
      if errors.Is(retryErr, ErrNoTriesLeft) {
        return *new(T), err
      }
      return retryData, retryErr
    }
    return *new(T), &EsiError{Message: error.Error, Code: response.StatusCode}
  }

  var data T
  err = decoder.Decode(&data)
  if err != nil {
    retryData, retryErr := EsiFetch[T](uri, method, query, body, tries-1)
    if errors.Is(retryErr, ErrNoTriesLeft) {
      return *new(T), err
    }
    return retryData, retryErr
  }

  return data, nil
}

func (e *EsiError) Error() string {
	return fmt.Sprintf("Esi error %d : %s", e.Code, e.Message)
}
