package prom

import (
	"strconv"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
)

func BenchmarkPromCounter(b *testing.B) {
	_, metrics := InitPrometheus()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		labels := prometheus.Labels{"query": "TEST", "status": "success", "duration": strconv.Itoa(i)}
		metrics.SqliteRequests.With(labels).Inc()
	}
}
