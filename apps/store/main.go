package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/raph5/eve-market-browser/apps/store/items/histories"
	"github.com/raph5/eve-market-browser/apps/store/items/orders"
	"github.com/raph5/eve-market-browser/apps/store/lib/database"
	"github.com/raph5/eve-market-browser/apps/store/lib/victoria"
)

func main() {
	// Init logger
	log.SetFlags(log.LstdFlags)

	// Flags
	var historiesEnabled, ordersEnabled, unixSocketEnabled, tcpEnabled, victoriaEnabled bool
	var socketPath, dbPath string
	var tcpPort int
	flag.BoolVar(&historiesEnabled, "history", true, "Enable histories update")
	flag.BoolVar(&ordersEnabled, "order", true, "Enable orders update")
	flag.BoolVar(&unixSocketEnabled, "socket", true, "Enable unix socket server")
	flag.BoolVar(&tcpEnabled, "tcp", false, "Enable tcp server")
	flag.BoolVar(&victoriaEnabled, "victoria", true, "Enable victoria metric server")
	flag.StringVar(&socketPath, "socket-path", "/tmp/emb.sock", "Path for the socket of the unix socket server")
	flag.StringVar(&dbPath, "db", "./data.db", "Path sqlite database")
	flag.IntVar(&tcpPort, "tcp-port", 7562, "Tcp server port")
	flag.Parse()

	// Init database
	db, err := database.Init(dbPath)
	if err != nil {
		log.Fatalf("Can't start up the database: %v", err)
	}
	defer db.Close()

	// Init context
	ctx, cancel := context.WithCancel(context.Background())
	ctx = context.WithValue(ctx, "db", db)
	exitCh := make(chan os.Signal, 1)
	signal.Notify(exitCh, syscall.SIGINT, syscall.SIGTERM)

	// Mux handler
	mux := http.NewServeMux()
	mux.HandleFunc("/order", orders.CreateHandler(ctx))
	mux.HandleFunc("/history", histories.CreateHandler(ctx))

	// Start workers and servers
	var mainWg sync.WaitGroup
	if unixSocketEnabled {
		mainWg.Add(1)
		go func() {
			runUnixSocketServer(ctx, mux, socketPath)
			log.Print("Unix socket server stopped")
			mainWg.Done()
			cancel()
		}()
	}
	if tcpEnabled {
		mainWg.Add(1)
		go func() {
			runTcpServer(ctx, mux, tcpPort)
			log.Print("Tcp server stopped")
			mainWg.Done()
			cancel()
		}()
	}
	if victoriaEnabled {
		mainWg.Add(1)
		go func() {
			victoria.RunVictoriaServer(ctx)
			log.Print("VictoriaMetrics stopped")
			mainWg.Done()
			cancel()
		}()
	}
	if ordersEnabled {
		mainWg.Add(1)
		go func() {
			runOrdersHoardling(ctx)
			log.Print("Order worker stopped")
			mainWg.Done()
			cancel()
		}()
	}
	if historiesEnabled {
		mainWg.Add(1)
		go func() {
			runHistoriesHoardling(ctx)
			log.Print("History worker stopped")
			mainWg.Done()
			cancel()
		}()
	}
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
