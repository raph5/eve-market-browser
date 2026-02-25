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
	flag.StringVar(&socketPath, "socket-path", "/tmp/emb.sock", "Path for the socket of the unix socket server")
	flag.StringVar(&dbPath, "db", "./data.db", "Path sqlite database")
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
	// the dbWrite value is added only to the context of dbWorker
	ctx = emd.EnableLogging(ctx)
	exitCh := make(chan os.Signal, 1)
	signal.Notify(exitCh, syscall.SIGINT, syscall.SIGTERM)

	// Create main channels
	orderDumpCh := make(chan orderDump)
	historyDumpCh := make(chan historyDump)
	newLocationCh := make(chan []emd.Location)

	// Starting wrokers
	var mainWg sync.WaitGroup
	mainWg.Add(3)
	go func() {
		orderWorker(ctx, &secrets, orderDumpCh, newLocationCh)
		log.Print("Order Worker: stopped")
		mainWg.Done()
		cancel()
	}()
	go func() {
		historyWorker(ctx, historyDumpCh)
		log.Print("History Worker: stopped")
		mainWg.Done()
		cancel()
	}()
	go func() {
		ctx = context.WithValue(ctx, "dbWrite", dbWrite)
		dbWorker(ctx, newLocationCh, historyDumpCh, orderDumpCh)
		log.Print("DB Worker: stopped")
		mainWg.Done()
		cancel()
	}()
	go func() {
		apiWorker(ctx, socketPath)
		log.Print("Http Server Worker: stopped")
		mainWg.Done()
		cancel()
	}()
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
