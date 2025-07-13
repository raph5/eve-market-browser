package metrics

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"
)

type apiItemStats struct {
	TypeId          int     `json:"typeId"`
	RegionId        int     `json:"regionId"`
	Year            int     `json:"year"`
	Day             int     `json:"day"`
	Volume          int64   `json:"volume"`
	WeeklyVolume    int64   `json:"weeklyVolume"`
	SellPrice       float64 `json:"sellPrice"`
	WeeklySellPrice float64 `json:"weeklySellPrice"`
	BuyPrice        float64 `json:"buyPrice"`
	WeeklyBuyPrice  float64 `json:"weeklyBuyPrice"`
}

func CreateItemStatsHandler(ctx context.Context) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		timeoutCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		defer cancel()

		query := r.URL.Query()
		typeId, err := strconv.Atoi(query.Get("type"))
		if err != nil {
			http.Error(w, `Bad request: param "type" is invalid integer`, 400)
			return
		}
		regionId, err := strconv.Atoi(query.Get("region"))
		if err != nil {
			http.Error(w, `Bad request: param "region" is invalid integer`, 400)
			return
		}
		date, err := time.Parse(dateLayout, query.Get("region"))
		if err != nil {
			http.Error(w, `Bad request: param "date" is invalid date of format YYYY-MM-DD`, 400)
			return
		}

		stats, err := dbGetItemStats(timeoutCtx, typeId, regionId, date)
		if err != nil {
			log.Printf("Internal server error: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(stats)
		if err != nil {
			log.Printf("Internal server error: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}
	}
}
