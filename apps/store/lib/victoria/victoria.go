package victoria

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/VictoriaMetrics/metrics"
)

func RunVicotriaServer(ctx context.Context) {
	errCh := make(chan error)
	mux := http.NewServeMux()
	server := &http.Server{
		Addr:    ":2112",
		Handler: mux,
	}

	mux.HandleFunc("/metrics", func(w http.ResponseWriter, req *http.Request) {
		metrics.WritePrometheus(w, true)
	})

	go func() {
		log.Print("Prometheus server up")
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
