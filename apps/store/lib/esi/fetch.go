package esi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/raph5/eve-market-browser/apps/store/lib/prom"
	"github.com/raph5/eve-market-browser/apps/store/lib/sem"
)

type EsiError struct {
	Message string
	Code    int
}

type jsonTimeoutError struct {
	Error   string `json:"error"`
	Timeout int    `json:"timeout"`
}
type jsonError struct {
	Error string `json:"error"`
}

const esiRoot = "https://esi.evetech.net/latest"
const DateLayout = "2006-01-02"
const MaxConcurrentRequests = 10

var ErrNoTrailsLeft = errors.New("Failed 5 esi fetching attempts")
var ErrImplicitTimeout = errors.New("Esi implicit timeout")
var ErrExplicitTimeout = errors.New("Esi explicit timeout")

var semaphore = sem.New(MaxConcurrentRequests)
var esiTimeout time.Time
var esiTimeoutMu sync.Mutex

func EsiFetch[T any](ctx context.Context, method string, uri string, body any, priority int, trails int,) (*T, error) {
	metrics := ctx.Value("metrics").(*prom.Metrics)

	// If no tries left, fail the request
	if trails <= 0 {
		labels := prometheus.Labels{"uri": uri, "result": "failure"}
		metrics.EsiRequests.With(labels).Inc()
		return new(T), ErrNoTrailsLeft
	}

	// Init retry function that will be called in case the request fail
	retry := func(fallbackData *T, fallbackErr error) (*T, error) {
		labels := prometheus.Labels{"uri": uri, "result": "retry"}
		metrics.EsiRequests.With(labels).Inc()

		retryData, retryErr := EsiFetch[T](ctx, method, uri, body, priority, trails-1)
		if errors.Is(retryErr, ErrNoTrailsLeft) {
			return fallbackData, fallbackErr
		}
		return retryData, retryErr
	}

	// Require premission from the semaphore
  timeoutCtx, cancel := context.WithTimeout(ctx, 15*time.Minute)
	thread, err := semaphore.AcquireWithContext(timeoutCtx, priority)
  cancel()  // cancel context if AcquireWithContext end before timeout
	if err != nil {
		return new(T), fmt.Errorf("semaphore: %w", err)
	}
	defer semaphore.Release(thread)

	// Wait for the api to be clear of any timeout
  timeoutCtx, cancel = context.WithTimeout(ctx, 15 * time.Minute)
  err = clearEsiTimeout(timeoutCtx)
  cancel()
  if err != nil {
    return new(T), fmt.Errorf("esi timeout clearing: %w", err)
  }

	// Create the request
	var jsonBody []byte
	if method == "POST" || method == "PUT" {
		jsonBody, err = json.Marshal(body)
		if err != nil {
      return new(T), fmt.Errorf("body mashalling: %w", err)
		}
	}
	request, err := http.NewRequestWithContext(ctx, method, uri, bytes.NewBuffer(jsonBody))
	if err != nil {
    return new(T), fmt.Errorf("new request: %w", err)
	}
	request.Header.Set("content-type", "application/json")
	request.Header.Set("User-Agent", "evemarketbrowser.com - contact me at raphguyader@gmail.com")

	// Run the request
	client := &http.Client{
		Timeout: 5 * time.Second,
	}
	response, err := client.Do(request)
	semaphore.Release(thread)
	if err != nil {
		if errors.Is(err, ctx.Err()) {
			labels := prometheus.Labels{"uri": uri, "result": "failure"}
			metrics.EsiRequests.With(labels).Inc()
			return new(T), fmt.Errorf("esi request: %w", err)
		}
    return retry(new(T), fmt.Errorf("http request: %w", err))
	}
	defer response.Body.Close()

  // Implicit timeout
	if response.StatusCode == 503 || response.StatusCode == 420 || response.StatusCode == 500 {
    declareEsiTimeout(10 * time.Second)

    log.Printf("Esi fetch: 10s implicit esi timeout %d", response.StatusCode)
		labels := prometheus.Labels{"code": response.Status, "message": ""}
		metrics.EsiErrors.With(labels).Inc()
		return retry(new(T), ErrImplicitTimeout)
	}

	decoder := json.NewDecoder(response.Body)
	decoder.UseNumber()
  // Explicit timeout
	if response.StatusCode == 504 {
		var timeoutError jsonTimeoutError
    var timeout time.Duration
		err = decoder.Decode(&timeoutError)
    if err != nil {
      log.Printf("Esi fetch: Can't decode esi timeout")
      timeout = 5 * time.Second
    } else {
      timeout = time.Duration(timeoutError.Timeout) * time.Second
    }
    declareEsiTimeout(timeout)

    log.Printf("Esi fetch: %fs explicit esi timeout %d", timeout.Seconds(), response.StatusCode)
		labels := prometheus.Labels{"code": response.Status, "message": timeoutError.Error}
		metrics.EsiErrors.With(labels).Inc()
		return retry(new(T), ErrExplicitTimeout)
	}

  // Esi error
	if response.StatusCode != 200 {
		var error jsonError
		err = decoder.Decode(&error)
		if err != nil {
      log.Printf("Esi fetch: Can't decode esi error")
			return retry(new(T), fmt.Errorf("decoding esi error: %w", err))
		}

		labels := prometheus.Labels{"code": response.Status, "message": error.Error}
		metrics.EsiErrors.With(labels).Inc()
		labels = prometheus.Labels{"uri": uri, "result": "failure"}
		metrics.EsiRequests.With(labels).Inc()
		return new(T), &EsiError{Message: error.Error, Code: response.StatusCode}
	}

	var data T
	err = decoder.Decode(&data)
	if err != nil {
    log.Print("Esi fetch: Can't decode 200 response body")
		return retry(new(T), fmt.Errorf("decoding response body: %w", err))
	}

	labels := prometheus.Labels{"uri": uri, "result": "success"}
	metrics.EsiRequests.With(labels).Inc()
	return &data, nil
}

func clearEsiTimeout(ctx context.Context) error {
  // This function need to be called in a timeout context
  for {
    esiTimeoutMu.Lock()
    esiTimeoutCopy := esiTimeout
    esiTimeoutMu.Unlock()
    if time.Now().After(esiTimeoutCopy) {
      return nil
    }
    timer := time.NewTimer(time.Until(esiTimeoutCopy))
    select {
    case <-timer.C:
    case <-ctx.Done():
      // NOTE: in go 1.23 it would not be necessary to drain the timer channel
      if !timer.Stop() {
        <-timer.C
      }
      return ctx.Err()
    }
  }
}

func declareEsiTimeout(duration time.Duration) {
  esiTimeoutMu.Lock()
  esiTimeout = esiTimeout.Add(duration)
  esiTimeoutMu.Unlock()
}

func (e *EsiError) Error() string {
	return fmt.Sprintf("Esi error %d : %s", e.Code, e.Message)
}
