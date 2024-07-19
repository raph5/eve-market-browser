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
const maxRequestsPerSeconds = 15

var requestSecond int64
var requestCount int
var requestMutex = &sync.Mutex{}

func EsiFetch[T any](uri string, method string, query map[string]string, body any) (T, error) {
  // check request rate to not go over maxRequestsPerSeconds
  unixTime := time.Now().UnixMilli()
  requestMutex.Lock()
  if unixTime < requestSecond + 1000 {
    secondsToSleep := requestCount / maxRequestsPerSeconds
    requestCount += 1
    requestMutex.Unlock()
    time.Sleep(time.Duration(secondsToSleep) * time.Second)
  } else {
    requestCount = max(requestCount - maxRequestsPerSeconds * (int(unixTime - requestSecond) / 1000), 0)
    requestSecond = unixTime
    requestMutex.Unlock()
  }

	serializedBody := make([]byte, 0)
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

	client := &http.Client{}

	for t := 0; t < 5; t++ {
		response, err := client.Do(request)
		if err != nil {
			continue
		}
		defer response.Body.Close()

		decoder := json.NewDecoder(response.Body)
		decoder.UseNumber()

    if response.StatusCode != 200 {
      log.Println(response.Status)
    }

		if response.StatusCode == 503 || response.StatusCode == 420 {
      log.Println("timeout")
			time.Sleep(1)
			continue
		}

		if response.StatusCode == 504 {
			var error jsonTimeoutError
			err = decoder.Decode(&error)
			if err != nil {
				continue
			}
			time.Sleep(time.Duration(error.Timeout) * time.Second)
			continue
		}

		if response.StatusCode != 200 {
			var error jsonError
			err = decoder.Decode(&error)
			if err != nil {
				continue
			}
			return *new(T), &EsiError{Message: error.Error, Code: response.StatusCode}
		}

		var data T
		err = decoder.Decode(&data)
		if err != nil {
			log.Println(err)
			continue
		}

		return data, nil
	}

	return *new(T), errors.New("Failed 5 esi fetching attempts")
}

func (e *EsiError) Error() string {
	return fmt.Sprintf("Esi error %d : %s", e.Code, e.Message)
}
