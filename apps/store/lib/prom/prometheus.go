package prom

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type Metrics struct {
	SqliteRequests     *prometheus.CounterVec
	SqliteTransactions *prometheus.CounterVec
	EsiRequests        *prometheus.CounterVec
	EsiErrors          *prometheus.CounterVec
	WorkerErrors       *prometheus.CounterVec
	OrderStatus        prometheus.Gauge
	HistoryStatus      prometheus.Gauge
}

func InitPrometheus() (*prometheus.Registry, *Metrics) {
	metrics := &Metrics{
		SqliteRequests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "store_sqlite_request_total",
			Help: "Number of sqlite requests performed (the duration is expimed in seconds)",
		}, []string{"query", "status", "duration"}),
		SqliteTransactions: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "store_sqlite_transaction_total",
			Help: "Number of sqlite transactions performed (the duration is expimed in seconds)",
		}, []string{"status", "duration"}),
		EsiRequests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "store_esi_request_total",
			Help: "Number of esi requests performed",
		}, []string{"uri", "result"}),
		EsiErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "store_esi_error_total",
			Help: "Number of esi errors received",
		}, []string{"code", "message"}),
		WorkerErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "store_worker_error_total",
			Help: "Number of errors encoutered by orders and histories workers",
		}, []string{"worker", "message"}),
		OrderStatus: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "store_order_status_info",
			Help: "The status of the order store. 1 mean the store is up to date and 0 mean it's not",
		}),
		HistoryStatus: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "store_history_status_info",
			Help: "The status of the order store. 1 mean the store is up to date and 0 mean it's not",
		}),
	}

	reg := prometheus.NewRegistry()
	reg.MustRegister(
		metrics.SqliteRequests,
		metrics.SqliteTransactions,
		metrics.EsiRequests,
		metrics.EsiErrors,
		metrics.WorkerErrors,
		metrics.OrderStatus,
		metrics.HistoryStatus,
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
		collectors.NewGoCollector(),
	)

	return reg, metrics
}

func RunPrometheusServer(ctx context.Context, reg *prometheus.Registry) {
	errCh := make(chan error)
	mux := http.NewServeMux()
	server := &http.Server{
		Addr:    ":2112",
		Handler: mux,
	}

	mux.Handle(
		"/metrics",
		promhttp.HandlerFor(reg, promhttp.HandlerOpts{Registry: reg}),
	)

	go func() {
		log.Print("Prometheus server up")
		err := server.ListenAndServe()
		if err != nil {
			errCh <- err
			return
		}
	}()

	select {
	case <-ctx.Done():
	case err := <-errCh:
		log.Printf("Prometheus server error: %v", err)
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	err := server.Shutdown(shutdownCtx)
	if err != nil {
		log.Printf("Prometheus server error: %v", err)
	}
}
