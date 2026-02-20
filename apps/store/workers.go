package main

import (
	"context"
	"log"
	"slices"
	"time"

	emd "github.com/raph5/eve-market-dump"
)

type orderDump struct {
	time  time.Time
	order []emd.Order
}

type historyDump struct {
	date    time.Time
	metrics []emd.HistoryDay
}

func orderWorker(
	ctx context.Context,
	secrets *emd.ApiSecrets,
	orderDumpCh chan<- orderDump,
	newLocationCh chan<- []emd.Location, // send newly discovered locations through this channel
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
		orderDumpCh <- orderDump{time: now, order: orders}
		expiration = expiration.Add(10 * time.Minute)
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
			newLocationCh <- newLocations
			log.Printf("Order Worker: location download end")
		}
	}
}

func historyWorker(
	ctx context.Context,
	historyDumpCh chan<- historyDump,
) {
	activeMarkets, err := dbGetActiveMarkets(ctx)
	if err != nil {
		log.Printf("Hisotry Worker Error: initial dbGetActiveMarketMap: %v", err)
		return
	}

	if len(activeMarkets) == 0 {
		sleepWithContext(ctx, 15*time.Minute)
		if err != nil {
			log.Printf("Hisotry Worker Error: initial dbGetActiveMarketMap: %v", err)
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

			historyDumpCh <- historyDump{date: date, metrics: metrics}
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

		historyDumpCh <- historyDump{date: date, metrics: metrics}
		expiration = expiration.Add(24 * time.Hour)
	}
}

func metricWorker() {
}

func apiWorker() {
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

// TODO: remove if unused
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
