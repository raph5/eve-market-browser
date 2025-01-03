package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"
)

func runTcpServer(ctx context.Context, mux *http.ServeMux, port int) {
	errCh := make(chan error)
	server := &http.Server{
		Addr:    ":" + strconv.Itoa(port),
		Handler: mux,
	}

	go func() {
		log.Printf("TCP server: listening on http://localhost%s", server.Addr)
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

	log.Print("TCP server: not listening")
}

func runUnixSocketServer(ctx context.Context, mux *http.ServeMux, socketPath string) {
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

	errCh := make(chan error)
	server := http.Server{
		Handler: mux,
	}

	go func() {
		log.Printf("Unix socket server: listening on %s", socketPath)
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

	log.Print("Unix socket server: not listening")
}
