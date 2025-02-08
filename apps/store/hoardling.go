// The hoardling is responsible for keeping the database up to date with the esi

package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/raph5/eve-market-browser/apps/store/items/activemarkets"
	"github.com/raph5/eve-market-browser/apps/store/items/histories"
	"github.com/raph5/eve-market-browser/apps/store/items/locations"
	"github.com/raph5/eve-market-browser/apps/store/items/orders"
	"github.com/raph5/eve-market-browser/apps/store/items/timerecord"
	"github.com/raph5/eve-market-browser/apps/store/lib/prom"
)

func runOrdersHoardling(ctx context.Context) {
	metrics := ctx.Value("metrics").(*prom.Metrics)

	for ctx.Err() == nil {
		now := time.Now()
		expiration, err := timerecord.Get(ctx, "OrdersExpiration")
		if err != nil {
			msg := fmt.Sprintf("orders hoardling error: timerecord get: %v", err)
			labels := prometheus.Labels{"worker": "order", "message": msg}
			metrics.WorkerErrors.With(labels).Inc()
			log.Print(msg)
			break
		}

		delta := expiration.Sub(now)
		if delta > 0 {
			metrics.OrderStatus.Set(1)
			log.Print("Orders hoardling: up to date")

			err := sleep(ctx, delta)
			if err == nil {
				metrics.OrderStatus.Set(0)
			}
			continue
		}

		metrics.OrderStatus.Set(0)
		log.Print("Orders hoardling: downloading orders and locations")

		err = orders.Download(ctx)
		if err != nil {
			msg := fmt.Sprintf("Orders hoardling error: orders download: %v", err)
			labels := prometheus.Labels{"worker": "order", "message": msg}
			metrics.WorkerErrors.With(labels).Inc()
			log.Print(msg)
			log.Print("Order hoardling: 2 minutes backoff")
			sleep(ctx, 2*time.Minute)
			continue
		}

		err = locations.Populate(ctx)
		if err != nil {
			msg := fmt.Sprintf("Orders hoardling error: locations populate: %v", err)
			labels := prometheus.Labels{"worker": "order", "message": msg}
			metrics.WorkerErrors.With(labels).Inc()
			log.Print(msg)
			if ctx.Err() != nil {
				break
			}
		}

		newExpiration := expiration.Add(-delta.Truncate(10*time.Minute) + 10*time.Minute)
		err = timerecord.Set(ctx, "OrdersExpiration", newExpiration)
		if err != nil {
			msg := fmt.Sprintf("Orders hoardling error: timerecord set: %v", err)
			labels := prometheus.Labels{"worker": "order", "message": msg}
			metrics.WorkerErrors.With(labels).Inc()
			log.Print(msg)
			break
		}
	}

	log.Print("Orders hoardling: stopping")
}

func runHistoriesHoardling(ctx context.Context) {
	metrics := ctx.Value("metrics").(*prom.Metrics)

	for ctx.Err() == nil {
		now := time.Now()
		expiration, err := timerecord.Get(ctx, "HistoriesExpiration")
		if err != nil {
			msg := fmt.Sprintf("Histories hoardling error: timerecord get: %v", err)
			labels := prometheus.Labels{"worker": "history", "message": msg}
			metrics.WorkerErrors.With(labels).Inc()
			log.Print(msg)
			break
		}

		delta := expiration.Sub(now)
		if delta > 0 {
			metrics.HistoryStatus.Set(1)
			log.Print("Histories hoardling: up to date")

			err := sleep(ctx, delta)
			if err == nil {
				metrics.OrderStatus.Set(0)
			}
			continue
		}

		metrics.HistoryStatus.Set(0)
		log.Print("Histories hoardling: downloading histories")

		err = activemarkets.Populate(ctx)
		if err != nil {
			msg := fmt.Sprintf("Histories hoardling error: active types populate: %v", err)
			labels := prometheus.Labels{"worker": "history", "message": msg}
			metrics.WorkerErrors.With(labels).Inc()
			log.Print(msg)
			continue
		}

		err = histories.Download(ctx)
		if err != nil {
			msg := fmt.Sprintf("Histories hoardling error: histories download: %v", err)
			labels := prometheus.Labels{"worker": "history", "message": msg}
			metrics.WorkerErrors.With(labels).Inc()
			log.Print(msg)
			log.Print("Histories hoardling: 5 minutes backoff")
			sleep(ctx, 5*time.Minute)
			continue
		}

		err = histories.ComputeGobalHistories(ctx)
		if err != nil {
			msg := fmt.Sprintf("Histories hoardling error: compute global histories: %v", err)
			labels := prometheus.Labels{"worker": "history", "message": msg}
			metrics.WorkerErrors.With(labels).Inc()
			log.Print(msg)
			if ctx.Err() != nil {
				break
			}
		}

		elevenFifteenTomorrow := time.Date(now.Year(), now.Month(), now.Day(), 11, 15, 0, 0, now.Location())
		if elevenFifteenTomorrow.Before(now) {
			elevenFifteenTomorrow = elevenFifteenTomorrow.AddDate(0, 0, 1)
		}
		err = timerecord.Set(ctx, "HistoriesExpiration", elevenFifteenTomorrow)
		if err != nil {
			msg := fmt.Sprintf("Histories hoardling error: timerecord set: %v", err)
			labels := prometheus.Labels{"worker": "history", "message": msg}
			metrics.WorkerErrors.With(labels).Inc()
			log.Print(msg)
			break
		}
	}

	log.Print("Histories hoardling: stopping")
}

func sleep(ctx context.Context, duration time.Duration) error {
	timer := time.NewTimer(duration)
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		if !timer.Stop() {
			<-timer.C
		}
		return ctx.Err()
	}
}
