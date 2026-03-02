package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"slices"
	"strconv"
	"time"

	emd "github.com/raph5/eve-market-dump"
)

func createOrderHandler(ctx context.Context) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {
		timeoutCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
		defer cancel()

		query := r.URL.Query()
		typeId, err := strconv.ParseUint(query.Get("type"), 10, 64)
		if err != nil {
			http.Error(w, `Bad request: param "type" is invalid integer`, 400)
			return
		}
		regionId, err := strconv.ParseUint(query.Get("region"), 10, 64)
		if err != nil {
			http.Error(w, `Bad request: param "region" is invalid integer`, 400)
			return
		}

		var orders []emd.Order
		if regionId == 0 || typeId == 44992 {
			orders, err = dbGetOrdersForType(timeoutCtx, typeId)
			if err != nil {
				log.Printf("Internal server error: dbGetOrdersForType: %v", err)
				http.Error(w, "Internal server error", 500)
				return
			}
		} else {
			orders, err = dbGetOrdersForTypeAndRegion(timeoutCtx, typeId, regionId)
			if err != nil {
				log.Printf("Internal server error: dbGetOrdersForTypeAndRegion: %v", err)
				http.Error(w, "Internal server error", 500)
				return
			}
		}

		locationIds := make([]uint64, 0, 128)
		locationSystem := make([]uint64, 0, 128)
		for i := range orders {
			if !slices.Contains(locationIds, orders[i].LocationId) {
				locationIds = append(locationIds, orders[i].LocationId)
				locationSystem = append(locationSystem, orders[i].SystemId)
			}
		}
		locationMap, err := dbGetLocationMapForIds(timeoutCtx, locationIds)
		if err != nil {
			log.Printf("Internal server error: dbGetLocationMap: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}
		for i := range locationIds {
			if _, ok := locationMap[locationIds[i]]; !ok {
				s, err := getSystemById(locationSystem[i])
				if err != nil {
					log.Printf("getSystemById: %v", err)
				}

				locationMap[locationIds[i]] = emd.Location{
					Id:       locationIds[i],
					Name:     s.name + " - Unknown Player Structure",
					SystemId: s.id,
					Security: s.security,
					RegionId: s.regionId,
				}
			}
		}

		validity, err := dbGetTimeRecord(timeoutCtx, "OrdersValidity")
		if err != nil {
			log.Printf("Internal server error: dbGetTimeRecord: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}

		marshaled, err := json.Marshal(map[string]any{
			"validity": validity.Unix(), // time at which we started to fetch the current order set
			"order":    orders,
			"location": locationMap,
		})
		if err != nil {
			log.Printf("Internal server error: json.Marshal: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, err = w.Write(marshaled)
		if err != nil {
			log.Printf("Internal server error: w.Write: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}
	}
}

func createDayMetricHandler(ctx context.Context) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {
		timeoutCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
		defer cancel()

		query := r.URL.Query()
		typeId, err := strconv.ParseUint(query.Get("type"), 10, 64)
		if err != nil {
			http.Error(w, `Bad request: param "type" is invalid integer`, 400)
			return
		}
		regionId, err := strconv.ParseUint(query.Get("region"), 10, 64)
		if err != nil {
			http.Error(w, `Bad request: param "region" is invalid integer`, 400)
			return
		}

		dayMetrics, err := dbGetDayMetricsForTypeAndRegion(timeoutCtx, typeId, regionId)
		if err != nil {
			log.Printf("Internal server error: dbGetDayMetricsForTypeAndRegion: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}

		marshaled, err := json.Marshal(dayMetrics)
		if err != nil {
			log.Printf("Internal server error: json.Marshal: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, err = w.Write(marshaled)
		if err != nil {
			log.Printf("Internal server error: w.Write: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}
	}
}
