package prom

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus"
)

type Metrics struct {
  EsiRequests *prometheus.CounterVec
  EsiErrors *prometheus.CounterVec
  WorkerErrors *prometheus.CounterVec
  OrderStatus prometheus.Gauge
  HistoryStatus prometheus.Gauge
}

func InitPrometheus() (*prometheus.Registry, *Metrics) {
  metrics := &Metrics{
    EsiRequests: prometheus.NewCounterVec(prometheus.CounterOpts{
      Name: "store_esi_request_total",
      Help: "Number of esi request performed",
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
  errCh := make(chan error, 1)
  server := &http.Server{
    Addr: ":2112",
  }

  http.Handle(
    "/metrics",
    promhttp.HandlerFor(reg, promhttp.HandlerOpts{Registry: reg}),
  )

  go func() {
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
