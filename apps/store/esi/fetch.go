package esi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/raph5/eve-market-browser/apps/store/prom"
	"github.com/raph5/eve-market-browser/apps/store/sem"
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
const DateLayout = "2006-01-02"
const MaxConcurrentRequests = 10

var ErrNoTriesLeft = errors.New("Failed 5 esi fetching attempts")

var semaphore = sem.New(MaxConcurrentRequests)
var apiTimeout int64
var apiTimeoutMu sync.RWMutex

// NOTE: I may want to split this big function in EsiFetch and EsiRawFetch.
// EsiRawFetch doing only the fetching operation and EsiFetch doing the
// preprocessing and postprocessing of EsiRawFetch.

func EsiFetch[T any](
  ctx context.Context,
  uri string,
  method string,
  query map[string]string,
  body any,
  priority int,
  tries int,
) (T, error) {
  metrics := ctx.Value("metrics").(*prom.Metrics)

  // if no tries left, fail the request
  if tries <= 0 {
    labels := prometheus.Labels{"uri": uri, "result": "failure"}
    metrics.EsiRequests.With(labels).Inc()
    return *new(T), ErrNoTriesLeft
  }

  // init retry function that will be called in case the request fail
  retry := func(fallbackData T, fallbackErr error) (T, error) {
    labels := prometheus.Labels{"uri": uri, "result": "retry"}
    metrics.EsiRequests.With(labels).Inc()
    select {
    case <-ctx.Done():
      return fallbackData, context.Canceled
    default:
      retryData, retryErr := EsiFetch[T](ctx, uri, method, query, body, priority, tries-1)
      if errors.Is(retryErr, ErrNoTriesLeft) {
        return fallbackData, fallbackErr
      }
      return retryData, retryErr
    }
  }

  // require premission from the semaphore
  err := semaphore.AcquireWithContext(ctx, priority)
  if err != nil {
    return *new(T), err
  }

  // wait for the api to be clear of any timeout
  for {
    now := time.Now().Unix()
    apiTimeoutMu.RLock()
    timeToWait := apiTimeout - now
    apiTimeoutMu.RUnlock()
    if timeToWait <= 0 {
      break
    }
    select {
    case <-time.After(time.Duration(timeToWait) * time.Second):
    case <-ctx.Done():
      semaphore.Release()
      return *new(T), context.Canceled
    }
  }

  // create the request
	var serializedBody []byte
	if method == "POST" || method == "PUT" {
		var err error
		serializedBody, err = json.Marshal(body)
		if err != nil {
      semaphore.Release()
			return *new(T), err
		}
	}
	u, err := url.Parse(esiUrl + uri)
	if err != nil {
    semaphore.Release()
		return *new(T), err
	}
	q := u.Query()
	for key, value := range query {
		q.Set(key, value)
	}
	u.RawQuery = q.Encode()
	finalUrl := u.String()

	request, err := http.NewRequestWithContext(ctx, method, finalUrl, bytes.NewBuffer(serializedBody))
	if err != nil {
    semaphore.Release()
		return *new(T), err
	}
	request.Header.Set("content-type", "application/json")
	request.Header.Set("User-Agent", "evemarketbrowser.com - contact me at raphguyader@gmail.com")

  // run the request
	client := &http.Client{
    Timeout: 5 * time.Second,
  }
  response, err := client.Do(request)
  semaphore.Release()
  if err != nil {
    if errors.Is(err, context.Canceled) {
      labels := prometheus.Labels{"uri": uri, "result": "failure"}
      metrics.EsiRequests.With(labels).Inc()
      return *new(T), err
    }
    return retry(*new(T), err)
  }
  defer response.Body.Close()

  // TODO: add downtime support
  if response.StatusCode == 503 || response.StatusCode == 420 || response.StatusCode == 500 {
    labels := prometheus.Labels{"code": response.Status, "message": ""}
    metrics.EsiErrors.With(labels).Inc()
    log.Printf("ESI timeout %d", response.StatusCode)
    apiTimeoutMu.Lock()
    apiTimeout = time.Now().Unix() + 15
    apiTimeoutMu.Unlock()
    return retry(*new(T), err)
  }

  decoder := json.NewDecoder(response.Body)
  decoder.UseNumber()
  if response.StatusCode == 504 {
    log.Printf("ESI timeout %d", response.StatusCode)
    var error jsonTimeoutError
    err = decoder.Decode(&error)
    labels := prometheus.Labels{"code": response.Status, "message": error.Error}
    metrics.EsiErrors.With(labels).Inc()
    if err == nil {
      apiTimeoutMu.Lock()
      apiTimeout = time.Now().Unix() + int64(min(error.Timeout, 15))
      apiTimeoutMu.Unlock()
    }
    return retry(*new(T), err)
  }

  if response.StatusCode != 200 {
    var error jsonError
    err = decoder.Decode(&error)
    labels := prometheus.Labels{"code": response.Status, "message": error.Error}
    metrics.EsiErrors.With(labels).Inc()
    if err != nil {
      return retry(*new(T), err)
    }
    labels = prometheus.Labels{"uri": uri, "result": "failure"}
    metrics.EsiRequests.With(labels).Inc()
    return *new(T), &EsiError{Message: error.Error, Code: response.StatusCode}
  }

  var data T
  err = decoder.Decode(&data)
  if err != nil {
    return retry(*new(T), err)
  }

  labels := prometheus.Labels{"uri": uri, "result": "success"}
  metrics.EsiRequests.With(labels).Inc()
  return data, nil
}

func (e *EsiError) Error() string {
	return fmt.Sprintf("Esi error %d : %s", e.Code, e.Message)
}
