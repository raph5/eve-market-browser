package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"

	emd "github.com/raph5/eve-market-dump"
)

func main() {
	// Init logger
	log.SetFlags(log.LstdFlags)

	// Init secrets
	secrets := emd.ApiSecrets{
		SsoRefreshToken: os.Getenv("SSO_REFRESH_TOKEN"),
		SsoClientId:     os.Getenv("SSO_CLIENT_ID"),
		SsoClientSecret: os.Getenv("SSO_CLIENT_SECRET"),
	}
	if secrets.SsoClientId == "" || secrets.SsoClientSecret == "" || secrets.SsoRefreshToken == "" {
		log.Fatal("Environement variabels SSO_REFRESH_TOKEN, SSO_CLIENT_ID and SSO_CLIENT_SECRET are not set")
	}

	// Create context
	ctx, cancel := context.WithCancel(context.Background())
	ctx = emd.EnableLogging(ctx)
	exitCh := make(chan os.Signal, 1)
	signal.Notify(exitCh, syscall.SIGINT, syscall.SIGTERM)

	// Starting wrokers
	var mainWg sync.WaitGroup
	mainWg.Add(3)
	go func() {
		historyWorker(ctx)
		log.Print("History Worker: stopped")
		mainWg.Done()
		cancel()
	}()
	go func() {
		orderWorker(ctx, &secrets)
		log.Print("Order Worker: stopped")
		mainWg.Done()
		cancel()
	}()
	go func() {
		httpServerWorker(ctx)
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
	log.Print("Web Server Stopped Gracefully")
}
