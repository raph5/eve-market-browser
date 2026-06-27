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

type previewMetric struct {
	Date        uint64
	BuyAverage  float64
	BuyVolume   uint64
	SellAverage float64
	SellVolume  uint64
	TradeVolume float64
}

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

func createVolumeHandler(ctx context.Context) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {
		timeoutCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
		defer cancel()

		typeIds := make([]uint64, 0)
		decoder := json.NewDecoder(r.Body)
		err := decoder.Decode(&typeIds)
		if err != nil {
			http.Error(w, `Bad request: body is not a list of type ids`, 400)
			return
		}

		volumeMap := make(map[uint64]float64)
		lastMonth := getLastMonth(time.Now())
		for _, typeId := range typeIds {
			dayMetrics, err := dbGetDayMetricsForTypeStartingFromDate(timeoutCtx, typeId, lastMonth)
			if err != nil {
				log.Printf("Internal server error: dbGetDayMetricsForTypeStartingFromDate: %v", err)
				http.Error(w, "Internal server error", 500)
				return
			}
			volumeMap[typeId] = computeVolume(dayMetrics)
		}

		marshaled, err := json.Marshal(volumeMap)
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

		locationIds := make([]uint64, 0, 182)
		locationSystems := make([]uint64, 0, 182)
		playerStructureIds := make([]uint64, 0, 128)
		for i := range orders {
			if !slices.Contains(locationIds, orders[i].LocationId) {
				locationIds = append(locationIds, orders[i].LocationId)
				locationSystems = append(locationSystems, orders[i].SystemId)
			}
			if isPlayerStructure(orders[i].LocationId) && !slices.Contains(playerStructureIds, orders[i].LocationId) {
				playerStructureIds = append(playerStructureIds, orders[i].LocationId)
			}
		}

		playerStructureMap, err := dbGetLocationMapForIds(timeoutCtx, playerStructureIds)
		if err != nil {
			log.Printf("Internal server error: dbGetLocationMapForIds: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}

		locationMap := make(map[uint64]emd.Location, len(locationIds))
		for i := range locationIds {
			if isPlayerStructure(locationIds[i]) {
				playerStructure, playerStructureOk := playerStructureMap[locationIds[i]]
				if playerStructureOk {
					locationMap[locationIds[i]] = playerStructure
				} else {
					s, systemOk := systemMap[locationSystems[i]]
					if !systemOk {
						log.Printf("Unknown solar system %d, You should renew data/systems.csv", locationSystems[i])
					}

					locationMap[locationIds[i]] = emd.Location{
						Id:       locationIds[i],
						SystemId: s.id,
						RegionId: s.regionId,
						Security: s.security,
						Name:     s.name + " - Unknown Player Structure",
					}
				}
			} else {
				npcStation, npcStationOk := stationMap[locationIds[i]]
				if npcStationOk {
					locationMap[locationIds[i]] = emd.Location{
						Id:       npcStation.id,
						SystemId: npcStation.systemId,
						RegionId: npcStation.regionId,
						Security: npcStation.security,
						Name:     npcStation.name,
					}
				} else {
					s, systemOk := systemMap[locationSystems[i]]
					if !systemOk {
						log.Printf("Unknown solar system %d, You should renew data/systems.csv", locationSystems[i])
					}

					locationMap[locationIds[i]] = emd.Location{
						Id:       locationIds[i],
						SystemId: s.id,
						RegionId: s.regionId,
						Security: s.security,
						Name:     s.name + " - Unknown NPC Station",
					}
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

func createPreviewMetricHandler(ctx context.Context) http.HandlerFunc {

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

		now := time.Now().UTC()
		// if we are between 11 and 15 pm it makes not much sens to display todays volume and prices
		if now.Hour() >= 11 && now.Hour() < 15 {
			now = time.Date(now.Year(), now.Month(), now.Day(), 10, 59, 0, 0, time.UTC)
		}

		today := getTodayMarketDay(now)
		lastWeek := getLastWeek(today).AddDate(0, 0, 1)
		lastWeekAtEleven := lastWeek.Add(11 * time.Hour)
		var tickMetrics []dbTickMetric
		if typeId == 44992 || regionId == 0 {
			tickMetrics, err = dbGetTickMetricsForTypeStartingFromDate(timeoutCtx, typeId, lastWeekAtEleven)
			if err != nil {
				log.Printf("Internal server error: dbGetTickMetricsForTypeStartingFromDate: %v", err)
				http.Error(w, "Internal server error", 500)
				return
			}
		} else {
			tickMetrics, err = dbGetTickMetricsForTypeAndRegionStartingFromDate(timeoutCtx, typeId, regionId, lastWeekAtEleven)
			if err != nil {
				log.Printf("Internal server error: dbGetTickMetricsForTypeAndRegionStartingFromDate: %v", err)
				http.Error(w, "Internal server error", 500)
				return
			}
		}

		sellOrderCount, buyOrderCount := getBuySellOrderTickCount(tickMetrics)
		if sellOrderCount < 20 || buyOrderCount < 20 {
			w.Header().Set("Content-Type", "application/json")
			_, err = w.Write([]byte("[]"))
			if err != nil {
				log.Printf("Internal server error: w.Write: %v", err)
				http.Error(w, "Internal server error", 500)
				return
			}
			return
		}

		previewMetrics := make([]previewMetric, 0, 7)
		tickMetricsOfLastWeek := getTickMetricsForDate(tickMetrics, lastWeek)
		tradingVolume := computeTradingVolume(tickMetricsOfLastWeek)
		buyVolume, sellVolume, buyPrice, sellPrice := computeBuySellVolumeAndBuySellPrice(tickMetricsOfLastWeek)
		previewMetrics = append(previewMetrics, previewMetric{
			Date:        uint64(lastWeek.Unix()),
			BuyVolume:   buyVolume,
			SellVolume:  sellVolume,
			BuyAverage:  buyPrice,
			SellAverage: sellPrice,
			TradeVolume: tradingVolume,
		})

		for d := lastWeek.AddDate(0, 0, 1); d.Before(today); d = d.AddDate(0, 0, 1) {
			tickMetricsOfTheDay := getTickMetricsForDate(tickMetrics, d)

			tradingVolume := computeTradingVolume(tickMetricsOfTheDay)
			buyVolume, sellVolume, buyPrice, sellPrice := computeBuySellVolumeAndBuySellPrice(tickMetricsOfTheDay)
			previewMetrics = append(previewMetrics, previewMetric{
				Date:        uint64(d.Unix()),
				BuyVolume:   buyVolume,
				SellVolume:  sellVolume,
				BuyAverage:  buyPrice,
				SellAverage: sellPrice,
				TradeVolume: tradingVolume,
			})
		}

		todayComplition := getDayComplition(now)
		tickMetricsOfToday := getTickMetricsForDate(tickMetrics, today)
		tradingVolume = computeTradingVolume(tickMetricsOfToday)
		buyVolume, sellVolume, buyPrice, sellPrice = computeBuySellVolumeAndBuySellPrice(tickMetricsOfToday)
		previewMetrics = append(previewMetrics, previewMetric{
			Date:        uint64(today.Unix()),
			BuyVolume:   uint64(float64(buyVolume) / todayComplition),
			SellVolume:  uint64(float64(sellVolume) / todayComplition),
			BuyAverage:  buyPrice,
			SellAverage: sellPrice,
			TradeVolume: tradingVolume / todayComplition,
		})

		// remove zeros
		if previewMetrics[0].BuyAverage == 0 {
			firstBuyAverage := float64(0)
			firstBuyAverageIdx := -1
			for i := range previewMetrics {
				if previewMetrics[i].BuyAverage > 0 {
					firstBuyAverage = previewMetrics[i].BuyAverage
					firstBuyAverageIdx = i
					break
				}
			}
			if firstBuyAverageIdx == -1 {
				log.Printf("Assertion failed: firstBuyAverageIdx should be positive be cause of the check at line 253")
			}
			for i := range firstBuyAverageIdx {
				previewMetrics[i].BuyAverage = firstBuyAverage
			}
		}
		if previewMetrics[0].SellAverage == 0 {
			firstSellAverage := float64(0)
			firstSellAverageIdx := -1
			for i := range previewMetrics {
				if previewMetrics[i].SellAverage > 0 {
					firstSellAverage = previewMetrics[i].SellAverage
					firstSellAverageIdx = i
					break
				}
			}
			if firstSellAverageIdx == -1 {
				log.Printf("Assertion failed: firstSellAverageIdx should be positive be cause of the check at line 253")
			}
			for i := range firstSellAverageIdx {
				previewMetrics[i].SellAverage = firstSellAverage
			}
		}
		for i := 1; i < len(previewMetrics); i++ {
			if previewMetrics[i].BuyAverage == 0 {
				previewMetrics[i].BuyAverage = previewMetrics[i-1].BuyAverage
			}
			if previewMetrics[i].SellAverage == 0 {
				previewMetrics[i].SellAverage = previewMetrics[i-1].SellAverage
			}
		}

		marshaled, err := json.Marshal(previewMetrics)
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

		var dayMetrics []dbDayMetric
		if typeId == 44992 {
			dayMetrics, err = dbGetDayMetricsForTypeAndRegion(timeoutCtx, typeId, 0)
			if err != nil {
				log.Printf("Internal server error: dbGetDayMetricsForType: %v", err)
				http.Error(w, "Internal server error", 500)
				return
			}
		} else {
			dayMetrics, err = dbGetDayMetricsForTypeAndRegion(timeoutCtx, typeId, regionId)
			if err != nil {
				log.Printf("Internal server error: dbGetDayMetricsForTypeAndRegion: %v", err)
				http.Error(w, "Internal server error", 500)
				return
			}
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

		dayMetricDate := time.Unix(int64(dayMetrics[j+1].Date), 0)
		for dayMetricDate.Before(d) {
			j += 1
			dayMetricDate = time.Unix(int64(dayMetrics[j+1].Date), 0)
		}

		if dayMetricDate.Equal(d) {
			j += 1
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

func getTickMetricsForDate(tickMetrics []dbTickMetric, date time.Time) []dbTickMetric {
	if !date.Equal(getToday(date)) {
		panic("date is not a valid date")
	}

	tickMetricsOfTheDay := make([]dbTickMetric, 0, len(tickMetrics))
	for _, d := range tickMetrics {
		if date.Equal(getTodayMarketDay(time.Unix(int64(d.Time), 0))) {
			tickMetricsOfTheDay = append(tickMetricsOfTheDay, d)
		}
	}

	return tickMetricsOfTheDay
}

func getDayComplition(now time.Time) float64 {
	nowMinusElevenHours := now.Add(-11 * time.Hour)
	durationSinceEleven := nowMinusElevenHours.Sub(getToday(nowMinusElevenHours))
	return float64(durationSinceEleven.Seconds()) / (60 * 60 * 24)
}

func getBuySellOrderTickCount(
	tickMetrics []dbTickMetric,
) (sellCount int, buyCount int) {
	for _, t := range tickMetrics {
		if t.IsBuyOrder {
			buyCount += 1
		} else {
			sellCount += 1
		}
	}
	return sellCount, buyCount
}

func computeTradingVolume(tickMetrics []dbTickMetric) float64 {
	var tradingVolume float64
	for _, t := range tickMetrics {
		tradingVolume += float64(t.Volume) * t.Average
	}
	return tradingVolume
}

func computeBuySellVolumeAndBuySellPrice(
	tickMetricsOfTheDay []dbTickMetric,
) (buyVolume uint64, sellVolume uint64, buyPrice float64, sellPrice float64) {
	for _, t := range tickMetricsOfTheDay {
		if t.Volume > 0 {
			if t.IsBuyOrder {
				buyPrice = (buyPrice*float64(buyVolume) + t.Average*float64(t.Volume)) /
					(float64(buyVolume) + float64(t.Volume))
				buyVolume += t.Volume
			} else {
				sellPrice = (sellPrice*float64(sellVolume) + t.Average*float64(t.Volume)) /
					(float64(sellVolume) + float64(t.Volume))
				sellVolume += t.Volume
			}
		}
	}
	return buyVolume, sellVolume, buyPrice, sellPrice
}

func computeVolume(dayMetrics []dbDayMetric) float64 {
	var volume float64
	for _, d := range dayMetrics {
		volume += float64(d.Volume) * d.Average
	}
	return volume
}

func isPlayerStructure(id uint64) bool {
	// see https://docs.esi.evetech.net/docs/asset_location_id.html
	return id > 64000000
}

func getLastMonth(now time.Time) time.Time {
	utc := now.UTC()
	return time.Date(utc.Year(), utc.Month()-1, utc.Day(), 0, 0, 0, 0, time.UTC)
}

func getLastWeek(now time.Time) time.Time {
	utc := now.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -7)
}

func getToday(now time.Time) time.Time {
	utc := now.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func getTodayMarketDay(now time.Time) time.Time {
	utc := now.UTC().Add(-11 * time.Hour)
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}
