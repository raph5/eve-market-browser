package esi

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/VictoriaMetrics/metrics"
	"github.com/raph5/eve-market-browser/apps/store/lib/secret"
	"github.com/raph5/eve-market-browser/apps/store/lib/sem"
	"github.com/raph5/eve-market-browser/apps/store/lib/victoria"
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
type jsonSsoResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
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
var accessToken string
var accessTokenExpiry time.Time

func EsiFetch[T any](
	ctx context.Context,
	method string,
	uri string,
	body any,
	authenticated bool,
	priority int,
	trails int,
) (EsiResponse[T], error) {
	// If no tries left, fail the request
	if trails <= 0 {
		reportEsiRequest("failure")
		return EsiResponse[T]{}, ErrNoTrailsLeft
	}

	// Init retry function that will be called in case the request fail
	retry := func(fallbackErr error) (EsiResponse[T], error) {
		reportEsiRequest("retry")
		retryResponse, retryErr := EsiFetch[T](ctx, method, uri, body, authenticated, priority, trails-1)
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
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "evemarketbrowser.com - contact me at raphguyader@gmail.com")
	if authenticated {
		token, err := acquireSSOToken(ctx)
		if err != nil {
			return EsiResponse[T]{}, fmt.Errorf("acquire SSO token: %w", err)
		}
		request.Header.Set("Authorization", "Bearer "+token)
	}

	// Run the request
	client := &http.Client{
		Timeout: requestTimeout,
	}
	response, err := client.Do(request)
	semaphore.Release(thread)
	if err != nil {
		if errors.Is(err, ctx.Err()) {
			reportEsiRequest("failure")
			return EsiResponse[T]{}, fmt.Errorf("esi request: %w", err)
		}
		return retry(fmt.Errorf("http request: %w", err))
	}
	defer response.Body.Close()

	// Implicit timeout
	if response.StatusCode == 503 || response.StatusCode == 500 {
		declareEsiTimeout(20 * time.Second)

		log.Printf("Esi fetch: 20s implicit esi timeout %d", response.StatusCode)
		reportEsiError(response.StatusCode, "")
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
		reportEsiError(response.StatusCode, "")
		return retry(ErrErrorRateTimeout)
	}

	decoder := json.NewDecoder(response.Body)
	// NOTE: I dont think the call to UseNumber is usefull as I dont Unmarshal to
	// interface{}. I might try to delete it in the future
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
		reportEsiError(response.StatusCode, timeoutError.Error)
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

		reportEsiError(response.StatusCode, error.Error)
		reportEsiRequest("failure")
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

	reportEsiRequest("success")
	return esiResponse, nil
}

func acquireSSOToken(ctx context.Context) (string, error) {
	sm := ctx.Value("sm").(*secret.SecretManager)
	clientId := sm.Get("ssoClientId")
	clientSecret := sm.Get("ssoClientSecret")
	refreshToken := sm.Get("ssoRefreshToken")

	now := time.Now()
	if now.Before(accessTokenExpiry) {
		return accessToken, nil
	}

	// Create the request
	url := "https://login.eveonline.com/v2/oauth/token"
	var body bytes.Buffer
	fmt.Fprintf(&body, "grant_type=refresh_token&refresh_token=%s", refreshToken)
	request, err := http.NewRequestWithContext(ctx, "POST", url, &body)
	if err != nil {
		return "", fmt.Errorf("new request: %w", err)
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.Header.Set("User-Agent", "evemarketbrowser.com - contact me at raphguyader@gmail.com")
	request.Header.Set("Authorization", createBasicAuthHeader(clientId, clientSecret))

	// Run the request
	client := &http.Client{
		Timeout: requestTimeout,
	}
	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("http request: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return "", fmt.Errorf("%d status code", response.StatusCode)
	}

	var ssoResponse jsonSsoResponse
	decoder := json.NewDecoder(response.Body)
	err = decoder.Decode(&ssoResponse)
	if err != nil {
		return "", fmt.Errorf("unmarshal sso response: %w", err)
	}
	if ssoResponse.TokenType != "Bearer" || ssoResponse.RefreshToken != refreshToken {
		log.Panicf("unexpected sso repseonse: %v", ssoResponse)
	}

	accessToken = ssoResponse.AccessToken
	accessTokenExpiry = now.Add(time.Duration(ssoResponse.ExpiresIn) * time.Second)
	if time.Now().After(accessTokenExpiry) {
		log.Panic("hummmm")
	}

	return accessToken, nil
}

func createBasicAuthHeader(user string, password string) string {
	payload := user + ":" + password
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(payload))
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

func reportEsiRequest(result string) {
	esiRequestMetric := fmt.Sprintf(`store_esi_request_total{status="%s"}`, result)
	metrics.GetOrCreateCounter(esiRequestMetric).Inc()
}

func reportEsiError(code int, message string) {
	esiErrorMetric := fmt.Sprintf(`store_esi_error_total{code="%d",message="%s"}`, code, victoria.Escape(message))
	metrics.GetOrCreateCounter(esiErrorMetric).Inc()
}
