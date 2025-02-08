package esi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
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
type EsiResponse[T any] struct {
	Data  *T
	Pages int
	// for pagniation purposes
	// see https://developers.eveonline.com/blog/article/esi-concurrent-programming-and-pagination
}

type jsonTimeoutError struct {
	Error   string `json:"error"`
	Timeout int    `json:"timeout"`
}
type jsonError struct {
	Error string `json:"error"`
}

const esiRoot = "https://esi.evetech.net/latest"
const requestTimeout = 7 * time.Second
const DateLayout = "2006-01-02"
const MaxConcurrentRequests = 10

var ErrNoTrailsLeft = errors.New("No trails left")
var ErrImplicitTimeout = errors.New("Esi implicit timeout")
var ErrErrorRateTimeout = errors.New("Esi error rate timeout")
var ErrExplicitTimeout = errors.New("Esi explicit timeout")

var semaphore = sem.New(MaxConcurrentRequests)
var esiTimeout time.Time
var esiTimeoutMu sync.Mutex

func EsiFetch[T any](ctx context.Context, method string, uri string, body any, priority int, trails int) (EsiResponse[T], error) {
	metrics := ctx.Value("metrics").(*prom.Metrics)

	// If no tries left, fail the request
	if trails <= 0 {
		labels := prometheus.Labels{"uri": uri, "result": "failure"}
		metrics.EsiRequests.With(labels).Inc()
		return EsiResponse[T]{}, ErrNoTrailsLeft
	}

	// Init retry function that will be called in case the request fail
	retry := func(fallbackErr error) (EsiResponse[T], error) {
		labels := prometheus.Labels{"uri": uri, "result": "retry"}
		metrics.EsiRequests.With(labels).Inc()

		retryResponse, retryErr := EsiFetch[T](ctx, method, uri, body, priority, trails-1)
		if errors.Is(retryErr, ErrNoTrailsLeft) {
			return EsiResponse[T]{}, fmt.Errorf("no trails left: %w", fallbackErr)
		}
		return retryResponse, retryErr
	}

	// Require premission from the semaphore
	timeoutCtx, cancel := context.WithTimeout(ctx, 15*time.Minute)
	thread, err := semaphore.AcquireWithContext(timeoutCtx, priority)
	cancel() // cancel context if AcquireWithContext end before timeout
	if err != nil {
		return EsiResponse[T]{}, fmt.Errorf("semaphore: %w", err)
	}
	defer semaphore.Release(thread)

	// Wait for the api to be clear of any timeout
	timeoutCtx, cancel = context.WithTimeout(ctx, 15*time.Minute)
	err = clearEsiTimeout(timeoutCtx)
	cancel()
	if err != nil {
		return EsiResponse[T]{}, fmt.Errorf("esi timeout clearing: %w", err)
	}

	// Create the request
	var jsonBody []byte
	if method == "POST" || method == "PUT" {
		jsonBody, err = json.Marshal(body)
		if err != nil {
			return EsiResponse[T]{}, fmt.Errorf("body mashalling: %w", err)
		}
	}
	request, err := http.NewRequestWithContext(ctx, method, esiRoot+uri, bytes.NewBuffer(jsonBody))
	if err != nil {
		return EsiResponse[T]{}, fmt.Errorf("new request: %w", err)
	}
	request.Header.Set("content-type", "application/json")
	request.Header.Set("User-Agent", "evemarketbrowser.com - contact me at raphguyader@gmail.com")

	// Run the request
	client := &http.Client{
		Timeout: requestTimeout,
	}
	response, err := client.Do(request)
	semaphore.Release(thread)
	if err != nil {
		if errors.Is(err, ctx.Err()) {
			labels := prometheus.Labels{"uri": uri, "result": "failure"}
			metrics.EsiRequests.With(labels).Inc()
			return EsiResponse[T]{}, fmt.Errorf("esi request: %w", err)
		}
		return retry(fmt.Errorf("http request: %w", err))
	}
	defer response.Body.Close()

	// Implicit timeout
	if response.StatusCode == 503 || response.StatusCode == 500 {
		declareEsiTimeout(20 * time.Second)

		log.Printf("Esi fetch: 20s implicit esi timeout %d", response.StatusCode)
		labels := prometheus.Labels{"code": response.Status, "message": ""}
		metrics.EsiErrors.With(labels).Inc()
		return retry(ErrImplicitTimeout)
	}

	// Error rate timeout
	if response.StatusCode == 420 {
		var timeout time.Duration
		secs, err := strconv.Atoi(response.Header.Get("X-Esi-Error-Limit-Reset"))
		if err != nil {
			log.Print("Esi fetch: Can't decode X-Esi-Error-Limit-Reset")
			timeout = 10 * time.Second
		} else if secs < 0 || secs > 120 {
			log.Printf("Esi fetch: X-Esi-Error-Limit-Reset out of range: %ds", secs)
			timeout = 10 * time.Second
		} else {
			timeout = time.Duration(secs) * time.Second
		}
		declareEsiTimeout(timeout)

		log.Printf("Esi fetch: %fs error rate timeout", timeout.Seconds())
		labels := prometheus.Labels{"code": response.Status, "message": ""}
		metrics.EsiErrors.With(labels).Inc()
		return retry(ErrErrorRateTimeout)
	}

	decoder := json.NewDecoder(response.Body)
	decoder.UseNumber()
	// Explicit timeout
	if response.StatusCode == 504 {
		var timeoutError jsonTimeoutError
		var timeout time.Duration
		err = decoder.Decode(&timeoutError)
		if err != nil {
			log.Print("Esi fetch: Can't decode esi timeout")
			timeout = 10 * time.Second
		} else if timeoutError.Timeout < 0 || timeoutError.Timeout > 120 {
			log.Printf("Esi fetch: esi timeout out of range: %ds", timeoutError.Timeout)
			timeout = 10 * time.Second
		} else {
			timeout = time.Duration(timeoutError.Timeout) * time.Second
		}
		declareEsiTimeout(timeout)

		log.Printf("Esi fetch: %fs explicit esi timeout", timeout.Seconds())
		labels := prometheus.Labels{"code": response.Status, "message": timeoutError.Error}
		metrics.EsiErrors.With(labels).Inc()
		return retry(ErrExplicitTimeout)
	}

	// Esi error
	if response.StatusCode != 200 {
		var error jsonError
		err = decoder.Decode(&error)
		if err != nil {
			log.Printf("Esi fetch: Can't decode esi error")
			return retry(fmt.Errorf("decoding esi error: %w", err))
		}

		labels := prometheus.Labels{"code": response.Status, "message": error.Error}
		metrics.EsiErrors.With(labels).Inc()
		labels = prometheus.Labels{"uri": uri, "result": "failure"}
		metrics.EsiRequests.With(labels).Inc()
		return EsiResponse[T]{}, &EsiError{Message: error.Error, Code: response.StatusCode}
	}

	var data T
	err = decoder.Decode(&data)
	if err != nil {
		log.Print("Esi fetch: Can't decode 200 response body")
		return retry(fmt.Errorf("decoding response body: %w", err))
	}

	var pages int
	xPages := response.Header.Get("X-Pages")
	if xPages != "" {
		pages, err = strconv.Atoi(xPages)
		if err != nil {
			log.Print("Esi fetch: Can't decode X-Pages")
		} else if pages < 0 || pages > 1000 {
			log.Printf("Esi fetch: X-Pages out of range: %d", pages)
		}
	}

	esiResponse := EsiResponse[T]{
		Data:  &data,
		Pages: pages,
	}

	labels := prometheus.Labels{"uri": uri, "result": "success"}
	metrics.EsiRequests.With(labels).Inc()
	return esiResponse, nil
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
	esiTimeout = time.Now().Add(duration)
	esiTimeoutMu.Unlock()
}

func (e *EsiError) Error() string {
	return fmt.Sprintf("Esi error %d : %s", e.Code, e.Message)
}
