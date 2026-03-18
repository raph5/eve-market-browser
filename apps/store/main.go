package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	emd "github.com/raph5/eve-market-dump"
)

// we fetch all orders every OrderFetchingPeriod
const OrderFetchingPeriod = 10 * time.Minute

// TODO: Add victoria metrics
func main() {
	// Init logger
	log.SetFlags(log.LstdFlags)

	// Flags
	var socketPath, dbPath string
	var working bool
	flag.StringVar(&socketPath, "socket-path", "/tmp/emb.sock", "Path for the socket of the unix socket server")
	flag.StringVar(&dbPath, "db", "./data.db", "Path sqlite database")
	flag.BoolVar(&working, "working", true, "Set working to false is you want the store to only serve data in DB and not to update itself. This is useful for testing")
	flag.Parse()

	// Init secrets
	secrets := emd.ApiSecrets{
		SsoRefreshToken: os.Getenv("SSO_REFRESH_TOKEN"),
		SsoClientId:     os.Getenv("SSO_CLIENT_ID"),
		SsoClientSecret: os.Getenv("SSO_CLIENT_SECRET"),
	}
	if secrets.SsoClientId == "" || secrets.SsoClientSecret == "" || secrets.SsoRefreshToken == "" {
		log.Fatal("Environement variabels SSO_REFRESH_TOKEN, SSO_CLIENT_ID and SSO_CLIENT_SECRET are not set")
	}

	// Init database
	dbWrite, dbRead, err := dbInit(dbPath)
	if err != nil {
		log.Fatalf("Database init error: %v", err)
	}
	defer dbWrite.Close()
	defer dbRead.Close()

	// Create context
	ctx, cancel := context.WithCancel(context.Background())
	ctx = context.WithValue(ctx, "dbRead", dbRead)
	ctx = context.WithValue(ctx, "dbWrite", dbWrite)
	ctx = emd.EnableLogging(ctx)
	exitCh := make(chan os.Signal, 1)
	signal.Notify(exitCh, syscall.SIGINT, syscall.SIGTERM)

	// Starting wrokers
	orderDumpCh := make(chan orderDump, 4)
	var mainWg sync.WaitGroup
	mainWg.Add(2)
	go func() {
		apiWorker(ctx, socketPath)
		log.Print("Api Worker: stopped")
		mainWg.Done()
		cancel()
	}()
	go func() {
		victoriaMetricsWorker(ctx)
		log.Print("VictoriaMetrics Worker: stopped")
		mainWg.Done()
		cancel()
	}()
	if working {
		mainWg.Add(3)
		go func() {
			orderWorker(ctx, orderDumpCh, &secrets)
			log.Print("Order Worker: stopped")
			mainWg.Done()
			cancel()
		}()
		go func() {
			historyWorker(ctx)
			log.Print("History Worker: stopped")
			mainWg.Done()
			cancel()
		}()
		go func() {
			tickMetricWorker(ctx, orderDumpCh)
			log.Print("Tick Metric Worker: stopped")
			mainWg.Done()
			cancel()
		}()
	}
	log.Print("Server Started")

	// Handle store shutdown
	select {
	case <-exitCh:
		log.Print("Web Server Stopping...")
		cancel()
	case <-ctx.Done():
	}
	signal.Reset(syscall.SIGINT, syscall.SIGTERM)
	mainWg.Wait()
	dbWrite.Close()
	dbRead.Close()
	log.Print("Web Server Stopped Gracefully")
}
