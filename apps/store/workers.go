package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"slices"
	"time"

	emd "github.com/raph5/eve-market-dump"
)

func orderWorker(
	ctx context.Context,
	secrets *emd.ApiSecrets,
) {
	expiration := time.Now()
	knownLocations := map[uint64]struct{}{}
	forbiddenLocations := map[uint64]struct{}{}

	for {
		if err := ctx.Err(); err != nil {
			return
		}

		now := time.Now()
		timeToWait := expiration.Sub(now)
		if timeToWait > 0 {
			log.Print("Order Worker: up to date")

			sleepWithContext(ctx, timeToWait)
			continue
		}

		log.Printf("Order Worker: orders download start")
		orders, err := emd.DownloadOrderDump(ctx)
		if err != nil {
			log.Printf("Order Worker Error: DownloadOrderDump: %v", err)
			continue
		}
		err = dbReplaceOrders(ctx, orders)
		if err != nil {
			log.Printf("Order Worker Error: dbReplaceOrders: %v", err)
			continue
		}
		err = dbSetTimeRecord(ctx, "OrdersValidity", now)
		if err != nil {
			log.Printf("Order Worker Error: dbSetTimeRecord: %v", err)
			continue
		}

		expiration = expiration.Add(OrderFetchingPeriod)
		log.Printf("Order Worker: orders download end")

		unknownLocation := getUnknownLocations(orders, knownLocations, forbiddenLocations)
		if len(unknownLocation) > 0 {
			log.Printf("Order Worker: location download start")
			newLocations, newForbiddenLocations, err := emd.DownloadLocationDump(ctx, unknownLocation, secrets)
			for _, id := range newForbiddenLocations {
				forbiddenLocations[id] = struct{}{}
			}
			if err != nil {
				log.Printf("Order Worker Error: DownloadLocationDump: %v", err)
				continue
			}

			err = dbAddLocations(ctx, newLocations)
			if err != nil {
				log.Printf("Order Worker Error: dbAddLocations: %v", err)
				continue
			}
			log.Printf("Order Worker: location download end")
		}

		activeMarkets := getActiveMarkets(orders)
		if len(activeMarkets) > 0 {
			err := dbSetActiveMarkets(ctx, activeMarkets, now)
			if err != nil {
				log.Printf("Order Worker Error: dbAddActiveMarkets: %v", err)
				continue
			}
		}
	}
}

func historyWorker(ctx context.Context) {
	activeMarkets, err := dbGetActiveMarkets(ctx)
	if err != nil {
		log.Printf("Hisotry Worker Error: initial dbGetActiveMarkets: %v", err)
		return
	}

	if len(activeMarkets) == 0 {
		activeMarkets, err := dbGetActiveMarkets(ctx)
		sleepWithContext(ctx, 15*time.Minute)
		if err != nil {
			log.Printf("Hisotry Worker Error: initial dbGetActiveMarkets: %v", err)
			return
		}
		if len(activeMarkets) == 0 {
			log.Printf("Hisotry Worker: Can't get active market list")
			return
		}
	}

	fullDownloadNeeded, err := dbIsDayMetricTableEmpty(ctx)
	if err != nil {
		log.Printf("Hisotry Worker Error: dbIsDayMetricTableEmpty: %v", err)
		return
	}

	workerStart := time.Now()

	if fullDownloadNeeded {
		log.Printf("History Worker: full download start")
		snapshot, err := emd.DownloadFullHistoryDump(ctx, activeMarkets)
		if err != nil {
			log.Printf("History Worker Error: DownloadFullHistoryDump: %v", err)
			return
		}
		defer snapshot.Close() // Important
		log.Printf("History Worker: full download processing")

		for _, date := range snapshot.Dates {
			metrics, err := snapshot.GetHistoryDataForDay(ctx, date)
			if err != nil {
				log.Printf("History Worker Error: GetHistoryDataForDay: %v", err)
				return
			}

			metrics = appendGlobalMetrics(metrics)
			err = dbAddDayMetrics(ctx, date, metrics)
			if err != nil {
				log.Printf("History Worker Error: dbAddDayMetrics: %v", err)
				return
			}
		}

		log.Printf("History Worker: full download end")
		err = snapshot.Close()
		if err != nil {
			log.Printf("History Worker Error: closing snapshot: %v", err)
			return
		}
	}

	elevenFifteenTomorrow := getElevenFifteenTomorrow(workerStart)
	elevenFifteenToday := getElevenFifteenToday(workerStart)
	expiration := elevenFifteenTomorrow
	if workerStart.Before(elevenFifteenToday) {
		expiration = elevenFifteenToday
	}

	for {
		if err := ctx.Err(); err != nil {
			return
		}

		now := time.Now()
		timeToWait := expiration.Sub(now)
		if timeToWait > 0 {
			log.Print("History Worker: up to date")

			sleepWithContext(ctx, timeToWait)
			continue
		}

		// here we assume that every market is up to date at 11:15 as stated at
		// https://developers.eveonline.com/api-explorer#/operations/GetMarketsRegionIdHistory
		log.Printf("History Worker: incremental download start")
		activeMarkets, err := dbGetActiveMarkets(ctx)
		if err != nil {
			log.Printf("History Worker Error: dbGetActiveMarkets: %v", err)
			continue
		}
		date := getYesterday(now)
		metrics, err := emd.DownloadIncrementalHistoryDump(ctx, activeMarkets, date)
		if err != nil {
			log.Printf("History Worker Error: DownloadIncrementalHistoryDump: %v", err)
			continue
		}
		log.Printf("History Worker: incremental download end")

		metrics = appendGlobalMetrics(metrics)
		err = dbAddDayMetrics(ctx, date, metrics)
		if err != nil {
			log.Printf("History Worker Error: dbAddDayMetrics: %v", err)
			continue
		}

		expiration = expiration.Add(24 * time.Hour)
	}
}

func tickMetricWorker() {
}

func apiWorker(ctx context.Context, socketPath string) {
	mux := http.NewServeMux()
	mux.HandleFunc("/order", createOrderHandler(ctx))
	mux.HandleFunc("/history", createDayMetricHandler(ctx))

	_, err := os.Stat(socketPath)
	if err == nil {
		err = os.Remove(socketPath)
		if err != nil {
			log.Printf("Api Worker Error: %v", err)
			return
		}
	}

	listener, err := net.Listen("unix", socketPath)
	if err != nil {
		log.Printf("Api Worker Error: %v", err)
		return
	}
	defer listener.Close()

	errCh := make(chan error)
	server := http.Server{
		Handler: mux,
	}

	go func() {
		log.Printf("Api Worker: listening on %s", socketPath)
		err := server.Serve(listener)
		if err != nil {
			errCh <- err
			return
		}
	}()

	select {
	case <-ctx.Done():
	case err = <-errCh:
		log.Printf("Api Worker Error: %v", err)
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	err = os.Remove(socketPath)
	if err != nil {
		log.Printf("Api Worker Error: %v", err)
	}
	err = server.Shutdown(shutdownCtx)
	if err != nil {
		log.Printf("Api Worker Error: %v", err)
	}

	log.Print("Api Worker: not listening")
}

func getElevenFifteenToday(now time.Time) time.Time {
	return time.Date(now.Year(), now.Month(), now.Day(), 11, 15, 0, 0, now.Location())
}

func getElevenFifteenTomorrow(now time.Time) time.Time {
	return time.Date(now.Year(), now.Month(), now.Day()+1, 11, 15, 0, 0, now.Location())
}

func getYesterday(now time.Time) time.Time {
	return time.Date(now.Year(), now.Month(), now.Day()-1, 0, 0, 0, 0, now.Location())
}

func getActiveMarkets(orders []emd.Order) []emd.HistoryMarket {
	activeMarketsMap := make(map[emd.HistoryMarket]struct{}, 350_000)
	activeMarkets := make([]emd.HistoryMarket, 0, 350_000)
	for _, o := range orders {
		market := emd.HistoryMarket{RegionId: o.RegionId, TypeId: o.TypeId}
		if _, ok := activeMarketsMap[market]; !ok {
			activeMarketsMap[market] = struct{}{}
			activeMarkets = append(activeMarkets, market)
		}
	}
	return activeMarkets
}

func getUnknownLocations(orders []emd.Order, knownLocations map[uint64]struct{}, forbiddenLocations map[uint64]struct{}) []uint64 {
	unknownLocations := make([]uint64, 0, 32)
	for _, o := range orders {
		if _, known := knownLocations[o.LocationId]; known {
			continue
		}
		if _, forbidden := forbiddenLocations[o.LocationId]; forbidden {
			continue
		}
		if slices.Contains(unknownLocations, o.LocationId) {
			continue
		}
		unknownLocations = append(unknownLocations, o.LocationId)
	}
	return unknownLocations
}

func appendGlobalMetrics(metrics []emd.HistoryDay) []emd.HistoryDay {
	globalMetricMap := make(map[emd.HistoryMarket]emd.HistoryDay)
	for _, day := range metrics {
		market := emd.HistoryMarket{RegionId: day.RegionId, TypeId: day.TypeId}
		gDay, ok := globalMetricMap[market]
		if ok {
			if day.Volume > 0 {
				gDay.Average = (gDay.Average*float64(gDay.Volume) + day.Average*float64(day.Volume)) /
					float64(gDay.Volume+day.Volume)
				if gDay.Volume == 0 {
					gDay.Lowest = day.Lowest
					gDay.Highest = day.Highest
				} else {
					gDay.Lowest = min(gDay.Lowest, day.Lowest)
					gDay.Highest = max(gDay.Highest, day.Highest)
				}
			}
			gDay.OrderCount += day.OrderCount
			gDay.Volume += day.Volume
			globalMetricMap[market] = gDay
		} else {
			day.RegionId = 0
			globalMetricMap[market] = day
		}
	}
	for market := range globalMetricMap {
		metrics = append(metrics, globalMetricMap[market])
	}
	return metrics
}

func sleepWithContext(ctx context.Context, duration time.Duration) error {
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
