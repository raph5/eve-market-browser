package main

import (
	"log"
	"net"
	"net/http"
	"os"

	"github.com/raph5/eve-market-browser/apps/store/commodities"
	"github.com/raph5/eve-market-browser/apps/store/diskStorage"
)

const socketPath = "/tmp/esi-store.sock"

func main() {
	// Init logger and diskStorage
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	err := diskStorage.Init()
	if err != nil {
		log.Fatal(err)
	}

	// Mux handler
	mux := http.NewServeMux()
	mux.HandleFunc("/regions", commodities.HandleRegionsRequest)
	mux.HandleFunc("/marketgroups", commodities.HandleMarketGroupsRequest)
	mux.HandleFunc("/types", commodities.HandleTypesRequest)
	mux.HandleFunc("/orders", commodities.HandleOrdersRequest)
	mux.HandleFunc("/history", commodities.HandleHistoryRequest)

	// Start commoities workers
	go commodities.RegionsWorker()
	go commodities.MarketGroupsWorker()
	go commodities.TypesWorker()
	// go commodities.OrdersWorker()
	go commodities.HistoryWroker()

	// Remove any existing socket file
	if _, err := os.Stat(socketPath); err == nil {
		log.Println("Removing existing socket file on startup")
		os.Remove(socketPath)
	}

	// Create socket
	log.Println("Creating socket")
	listener, err := net.Listen("unix", socketPath)
	if err != nil {
		log.Fatal(err)
	}
	defer listener.Close()

	// Http server
	log.Println("Sarting http server")
	err = http.Serve(listener, mux)
	if err != nil {
		log.Fatal(err)
	}
}
