package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"time"
)

const socketPath = "/tmp/esi-store.sock"

func runTcpServer(ctx context.Context, mux *http.ServeMux) {
	errCh := make(chan error, 1)
	server := &http.Server{
		Addr:    ":7001",
		Handler: mux,
	}

	go func() {
		log.Print("Store listening on http://localhost" + server.Addr)
		err := server.ListenAndServe()
		if err != nil {
			errCh <- err
			return
		}
	}()

	select {
	case <-ctx.Done():
	case err := <-errCh:
		log.Printf("TCP server error: %v", err)
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	err := server.Shutdown(shutdownCtx)
	if err != nil {
		log.Printf("TCP server error: %v", err)
	}
}

func runUnixSocketServer(ctx context.Context, mux *http.ServeMux) {
	_, err := os.Stat(socketPath)
	if err == nil {
		err = os.Remove(socketPath)
		if err != nil {
			log.Printf("Unix socket server error: %v", err)
			return
		}
	}

	listener, err := net.Listen("unix", socketPath)
	if err != nil {
		log.Printf("Unix socket server error: %v", err)
		return
	}
	defer listener.Close()

	errCh := make(chan error, 1)
	server := http.Server{
		Handler: mux,
	}

	go func() {
		log.Print("Store listening")
		err := server.Serve(listener)
		if err != nil {
			errCh <- err
			return
		}
	}()

	select {
	case <-ctx.Done():
	case err = <-errCh:
		log.Printf("Unix socket server error: %v", err)
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	err = os.Remove(socketPath)
	if err != nil {
		log.Printf("Unix socket server error: %v", err)
	}
	err = server.Shutdown(shutdownCtx)
	if err != nil {
		log.Printf("Unix socket server error: %v", err)
	}
}
