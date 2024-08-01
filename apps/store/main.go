package main

import (
	"log"
	"net"
	"net/http"
	"os"

)

type Order struct {
	Duration     int     `json:"duration"`
	IsBuyOrder   bool    `json:"is_buy_order"`
	Issued       string  `json:"issued"`
	LocationId   int     `json:"location_id"`
	MinVolume    int     `json:"min_volume"`
	OrderId      int     `json:"order_id"`
	Price        float64 `json:"price"`
	Range        string  `json:"range"`
	Systemid     int     `json:"system_id"`
	TypeId       int     `json:"type_id"`
	VolumeRemain int     `json:"volume_remain"`
	VolumeTotal  int     `json:"volume_total"`
}

const socketPath = "/tmp/esi-store.sock"

func main() {
	// Init logger and diskStorage
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// Mux handler
	mux := http.NewServeMux()
	// mux.HandleFunc("/orders", commodities.HandleOrdersRequest)

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
