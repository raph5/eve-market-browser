// The hoardling is responsible for keeping the database up to date with the esi

package main

import (
	"context"
	"log"
	"time"

	"github.com/VictoriaMetrics/metrics"
	"github.com/raph5/eve-market-browser/apps/store/items/activemarkets"
	"github.com/raph5/eve-market-browser/apps/store/items/histories"
	"github.com/raph5/eve-market-browser/apps/store/items/locations"
	"github.com/raph5/eve-market-browser/apps/store/items/orders"
	"github.com/raph5/eve-market-browser/apps/store/items/timerecord"
)

var (
	orderStatus   = metrics.NewCounter("store_order_status_info")
	historyStatus = metrics.NewCounter("store_history_status_info")
)

func runOrdersHoardling(ctx context.Context) {
	structuresEnabled := ctx.Value("structuresEnabled").(bool)

	for ctx.Err() == nil {
		now := time.Now()
		expiration, err := timerecord.Get(ctx, "OrdersExpiration")
		if err != nil {
			log.Printf("orders hoardling error: timerecord get: %v", err)
			break
		}

		delta := expiration.Sub(now)
		if delta > 0 {
			orderStatus.Set(1)
			log.Print("Orders hoardling: up to date")

			err := sleep(ctx, delta)
			if err == nil {
				orderStatus.Set(0)
			}
			continue
		}

		orderStatus.Set(0)
		log.Print("Orders hoardling: downloading orders and locations")

		err = orders.Download(ctx)
		if err != nil {
			log.Printf("Orders hoardling error: orders download: %v", err)
			log.Print("Order hoardling: 2 minutes backoff")
			sleep(ctx, 2*time.Minute)
			continue
		}

		if structuresEnabled {
			err = locations.PopulateStructure(ctx)
			if err != nil {
				log.Printf("Orders hoardling error: locations populate structures: %v", err)
				if ctx.Err() != nil {
					break
				}
			}
		}

		// NOTE: a better approach would have been to use the `Expires`
		// header provided by the esi.
		// The probleme with the current implementation is that orders data can
		// change will Im fetching the orders batch
		var newExpiration time.Time
		if expiration.IsZero() {
			newExpiration = time.Now().Add(10 * time.Minute)
		} else {
			newExpiration = expiration.Add(-delta.Truncate(10*time.Minute) + 10*time.Minute)
		}
		err = timerecord.Set(ctx, "OrdersExpiration", newExpiration)
		if err != nil {
			log.Printf("Orders hoardling error: timerecord set: %v", err)
			break
		}
	}

	log.Print("Orders hoardling: stopping")
}

func runHistoriesHoardling(ctx context.Context) {
	for ctx.Err() == nil {
		now := time.Now()
		expiration, err := timerecord.Get(ctx, "HistoriesExpiration")
		if err != nil {
			log.Printf("Histories hoardling error: timerecord get: %v", err)
			break
		}

		delta := expiration.Sub(now)
		if delta > 0 {
			historyStatus.Set(1)
			log.Print("Histories hoardling: up to date")

			err := sleep(ctx, delta)
			if err == nil {
				historyStatus.Set(0)
			}
			continue
		}

		day := time.Now()
		historyStatus.Set(0)
		log.Print("Histories hoardling: downloading histories")

		err = activemarkets.Populate(ctx)
		if err != nil {
			log.Printf("Histories hoardling error: active types populate: %v", err)
			continue
		}

		err = histories.Download(ctx)
		if err != nil {
			log.Printf("Histories hoardling error: histories download: %v", err)
			log.Print("Histories hoardling: 5 minutes backoff")
			sleep(ctx, 5*time.Minute)
			continue
		}

		err = histories.ComputeGobalHistories(ctx, day)
		if err != nil {
			log.Printf("Histories hoardling error: compute global histories: %v", err)
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
			log.Printf("Histories hoardling error: timerecord set: %v", err)
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
