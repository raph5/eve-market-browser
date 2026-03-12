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

type apiDayMetric struct {
	Date           uint64  `json:"date"`
	Average        float64 `json:"average"`
	Average5d      float64 `json:"average5d"`
	Average20d     float64 `json:"average20d"`
	Highest        float64 `json:"highest"`
	Lowest         float64 `json:"lowest"`
	OrderCount     uint64  `json:"orderCount"`
	Volume         uint64  `json:"volume"`
	DonchianTop    float64 `json:"donchianTop"`
	DonchianBottom float64 `json:"donchianBottom"`
}

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
		apiDayMetrics := computeApiDayMetrics(dayMetrics)

		marshaled, err := json.Marshal(apiDayMetrics)
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

func computeApiDayMetrics(dayMetrics []dbDayMetric) []apiDayMetric {
	if len(dayMetrics) == 0 {
		return make([]apiDayMetric, 0)
	}

	firstDate := time.Unix(int64(dayMetrics[0].Date), 0)
	lastDate := time.Unix(int64(dayMetrics[len(dayMetrics)-1].Date), 0)
	deltaDate := int(lastDate.Sub(firstDate).Hours() / 24)
	if deltaDate < 0 || deltaDate > 10000 {
		panic("unexptected date range")
	}
	apiDayMetrics := make([]apiDayMetric, deltaDate+1)

	// copy data from dayMetrics to apiDayMetrics and add missing days
	j := -1
	for i, d := 0, firstDate; i < len(apiDayMetrics); i, d = i+1, d.Add(24*time.Hour) {
		if j+1 >= len(dayMetrics) {
			panic("messed up date order")
		}

		if time.Unix(int64(dayMetrics[j+1].Date), 0).Equal(d) {
			j++
			apiDayMetrics[i].Volume = dayMetrics[j].Volume
			apiDayMetrics[i].Date = dayMetrics[j].Date
			apiDayMetrics[i].Lowest = dayMetrics[j].Lowest
			apiDayMetrics[i].Highest = dayMetrics[j].Highest
			apiDayMetrics[i].Average = dayMetrics[j].Average
			apiDayMetrics[i].OrderCount = dayMetrics[j].OrderCount
		} else {
			if j == -1 {
				panic("impossible point to reach")
			}
			apiDayMetrics[i].Volume = 0
			apiDayMetrics[i].Date = uint64(d.Unix())
			apiDayMetrics[i].Lowest = dayMetrics[j].Average
			apiDayMetrics[i].Highest = dayMetrics[j].Average
			apiDayMetrics[i].Average = dayMetrics[j].Average
			apiDayMetrics[i].OrderCount = dayMetrics[j].OrderCount
		}
	}

	apiDayMetrics[0].Average5d = apiDayMetrics[0].Average
	apiDayMetrics[0].Average20d = apiDayMetrics[0].Average
	apiDayMetrics[0].DonchianTop = apiDayMetrics[0].Highest
	apiDayMetrics[0].DonchianBottom = apiDayMetrics[0].Lowest
	for i := 1; i < len(apiDayMetrics); i++ {
		// compute rolling average 5 days
		avg5 := (6*apiDayMetrics[i-1].Average5d -
			apiDayMetrics[max(0, i-6)].Average +
			apiDayMetrics[i].Average) / 6

		// compute rolling average 20 days
		avg20 := (21*apiDayMetrics[i-1].Average20d -
			apiDayMetrics[max(0, i-21)].Average +
			apiDayMetrics[i].Average) / 21

		// compute donchian top
		var dcTop float64
		if apiDayMetrics[i-1].DonchianTop == apiDayMetrics[max(0, i-6)].Highest {
			j := max(0, i-5)
			dcTop = apiDayMetrics[j].Highest
			// NOTE: this loop will end because j < i
			for j = j + 1; j <= i; j++ {
				if apiDayMetrics[j].Highest > dcTop {
					dcTop = apiDayMetrics[j].Highest
				}
			}
		} else {
			dcTop = max(apiDayMetrics[i-1].DonchianTop, apiDayMetrics[i].Highest)
		}

		// compute donchian bottom
		var dcBottom float64
		if apiDayMetrics[i-1].DonchianBottom == apiDayMetrics[max(0, i-6)].Lowest {
			j := max(0, i-5)
			dcBottom = apiDayMetrics[j].Lowest
			// NOTE: this loop will end because j < i
			for j = j + 1; j <= i; j++ {
				if apiDayMetrics[j].Lowest < dcBottom {
					dcBottom = apiDayMetrics[j].Lowest
				}
			}
		} else {
			dcBottom = min(apiDayMetrics[i-1].DonchianBottom, apiDayMetrics[i].Lowest)
		}

		apiDayMetrics[i].Average5d = avg5
		apiDayMetrics[i].Average20d = avg20
		apiDayMetrics[i].DonchianTop = dcTop
		apiDayMetrics[i].DonchianBottom = dcBottom
	}

	return apiDayMetrics
}
