package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/raph5/eve-market-browser/apps/store/prom"
)

const socketPath = "/tmp/esi-store.sock"

func main() {
	// Init logger and diskStorage
	log.SetFlags(log.LstdFlags | log.Lshortfile)

  // Init database
  writeDB, readDB, err := initDatabase()
  if err != nil {
    log.Fatalf("Can't start up the database: %v", err)
  }
  defer writeDB.Close()
  defer readDB.Close()

  // Init prometheus
  reg, metrics := prom.InitPrometheus()

  // Init context
  ctx, cancel := context.WithCancel(context.Background())
  ctx = context.WithValue(ctx, "writeDB", writeDB)
  ctx = context.WithValue(ctx, "readDB", readDB)
  ctx = context.WithValue(ctx, "metrics", metrics)
  exitCh := make(chan os.Signal, 1)
  signal.Notify(exitCh, syscall.SIGINT, syscall.SIGTERM)

	// Mux handler
	mux := http.NewServeMux()
	mux.HandleFunc("/order", createOrderHandler(ctx))
	mux.HandleFunc("/history", createHisoryHandler(ctx))

  // Start workers and servers
  var mainWg sync.WaitGroup
  mainWg.Add(3)
  go func() {
    defer mainWg.Done()
    prom.RunPrometheusServer(ctx, reg)
    cancel()
  }()
  go func() {
    defer mainWg.Done()
    orderWorker(ctx)
    cancel()
  }()
  go func() {
    defer mainWg.Done()
    historyWorker(ctx)
    cancel()
  }()

	// // Remove any existing socket file
	// if _, err := os.Stat(socketPath); err == nil {
	// 	log.Println("Removing existing socket file on startup")
	// 	os.Remove(socketPath)
	// }

	// // Create socket
	// log.Println("Creating socket")
	// listener, err := net.Listen("unix", socketPath)
	// if err != nil {
	// 	log.Fatal(err)
	// }
	// defer listener.Close()

	// // Http server
	// log.Println("Sarting http server")
	// err = http.Serve(listener, mux)
	// if err != nil {
	// 	log.Fatal(err)
	// }

  log.Print("Store is up")

  // Handle store shutdown
  select {
  case <-exitCh:
    log.Print("Stopping the store...")
    cancel()
  case <-ctx.Done():
  }
  mainWg.Wait()
  log.Print("Store stopped")
}

func orderWorker(ctx context.Context) {
  metrics := ctx.Value("metrics").(*prom.Metrics)
  for {
    select {
    case <-ctx.Done():
      log.Print("Order worker stopped")
      return
    default:
      now := time.Now()
      expiration, err := getExpirationTime(ctx, "Order")
      if err != nil {
        labels := prometheus.Labels{"worker": "order", "message": err.Error()}
        metrics.WorkerErrors.With(labels).Inc()
        log.Printf("Order worker stopping unexpectedly: %v", err)
        return
      }
      delta := expiration.Sub(now)

      if delta > 0 {
        metrics.OrderStatus.Set(1)
        log.Print("Order worker up to date")
        select {
        case <-time.After(delta):
          metrics.OrderStatus.Set(0)
        case <-ctx.Done():
        }
        continue
      }

      metrics.OrderStatus.Set(0)
      log.Print("Order worker downloading orders and locations")
      err = downloadOrders(ctx)
      if err != nil {
        labels := prometheus.Labels{"worker": "order", "message": err.Error()}
        metrics.WorkerErrors.With(labels).Inc()
        if errors.Is(err, context.Canceled) {
          log.Print("Order worker stopped")
          return
        }
        log.Printf("Order worker reporting: %v", err)
        continue
      }

      err = downloadLocations(ctx)
      if err != nil {
        labels := prometheus.Labels{"worker": "order", "message": err.Error()}
        metrics.WorkerErrors.With(labels).Inc()
        if errors.Is(err, context.Canceled) {
          log.Print("Order worker stopped")
          return
        }
        log.Printf("Order worker reporting: %v", err)
      }

      newExpiration := expiration.Add(-delta.Truncate(10*time.Minute) + 10*time.Minute)
      err = setExpirationTime(ctx, "Order", newExpiration)
      if err != nil {
        labels := prometheus.Labels{"worker": "order", "message": err.Error()}
        metrics.WorkerErrors.With(labels).Inc()
        log.Printf("Order worker stopping unexpectedly: %v", err)
        return
      }
    }
  }
}

func historyWorker(ctx context.Context) {
  metrics := ctx.Value("metrics").(*prom.Metrics)
  for {
    select {
    case <-ctx.Done():
      log.Print("History worker stopped")
      return
    default :
      now := time.Now()
      expiration, err := getExpirationTime(ctx, "History")
      if err != nil {
        labels := prometheus.Labels{"worker": "history", "message": err.Error()}
        metrics.WorkerErrors.With(labels).Inc()
        log.Printf("History worker stopping unexpectedly: %v", err)
        return
      }
      delta := expiration.Sub(now)

      if delta > 0 {
        metrics.HistoryStatus.Set(1)
        log.Print("History worker up to date")
        select {
        case <-time.After(delta):
          metrics.HistoryStatus.Set(0)
        case <-ctx.Done():
        }
        continue
      }

      metrics.HistoryStatus.Set(0)
      log.Print("History worker downloading histories")
      err = populateActiveTypes(ctx)
      if err != nil {
        labels := prometheus.Labels{"worker": "history", "message": err.Error()}
        metrics.WorkerErrors.With(labels).Inc()
        log.Printf("History worker reporting: %v", err)
        continue
      }

      err = downloadHistories(ctx)
      if err != nil {
        labels := prometheus.Labels{"worker": "history", "message": err.Error()}
        metrics.WorkerErrors.With(labels).Inc()
        if errors.Is(err, context.Canceled) {
          log.Print("History worker stopped")
          return
        }
        log.Printf("History worker reporting: %v", err)
        continue
      }

      elevenFifteenTomorrow := time.Date(now.Year(), now.Month(), now.Day(), 11, 15, 0, 0, now.Location())
      if elevenFifteenTomorrow.Before(now) {
        elevenFifteenTomorrow = elevenFifteenTomorrow.AddDate(0, 0, 1)
      }
      err = setExpirationTime(ctx, "History", elevenFifteenTomorrow)
      if err != nil {
        labels := prometheus.Labels{"worker": "history", "message": err.Error()}
        metrics.WorkerErrors.With(labels).Inc()
        log.Printf("History worker stopping unexpectedly: %v", err)
        return
      }
    }
  }
}
