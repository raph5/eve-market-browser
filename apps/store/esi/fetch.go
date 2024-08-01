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

var semaphore = make(chan struct{}, 10)
// TODO: add support for api state

func EsiFetch[T any](uri string, method string, query map[string]string, body any) (T, error) {
  semaphore <- struct{}{}

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

	for t := 0; t < 5; t++ {
    var response *http.Response
		response, err = client.Do(request)
		if err != nil {
			continue
		}
		defer response.Body.Close()

		decoder := json.NewDecoder(response.Body)
		decoder.UseNumber()

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
  
  <- semaphore

	return *new(T), errors.New("Failed 5 esi fetching attempts")
}

func (e *EsiError) Error() string {
	return fmt.Sprintf("Esi error %d : %s", e.Code, e.Message)
}
