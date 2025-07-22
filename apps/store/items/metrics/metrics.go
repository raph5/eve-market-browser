// Metrics is the package responsible for providing api to compute, store and
// retrive time series metrics that are computed using data available in db (no
// external request a priori)
//
// NOTE: DayTypeMetric is a bit of a diplicate of History. One day I could
// perhaps merge this two tables

package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/items/shared"
	"github.com/raph5/eve-market-browser/apps/store/lib/esi"
	"github.com/raph5/eve-market-browser/apps/store/lib/utils"
)

type dbOrder = shared.DbOrder
type dbHistory = shared.DbHistory
type esiHistoryDay = shared.EsiHistoryDay

type market struct {
	typeId   int
	regionId int
}

type marketMetrics struct {
	sellPrice       float64
	sellPriceWeight float64
	buyPrice        float64
	buyPriceWeight  float64
}

type DayDataPoint struct {
	typeId    int
	regionId  int
	date      time.Time
	sellPrice float64
	buyPrice  float64
	volume    int64
}

const dateLayout = "2006-01-02"

// Each time the store fetches a new set of orders it updates a set of metrics
// such as the lowest buy/sell price or the buy/sell volume. These metrics are
// stored in ram in the variable `dayMetrics`. Those mesurements are stored in
// DB each day during the computation of global histories. The day that was
// stored in DB in then deleted.
var metricsRecord = make(map[time.Time]map[market]marketMetrics)
var metricsRecordMu sync.RWMutex

// Saves computed metrics to `metricsReocrd`
func ComputeOrdersMetrics(ctx context.Context, retrivalTime time.Time, orders []dbOrder) error {
	today := utils.GetDate(retrivalTime)
	ordersPtr := make([]*dbOrder, len(orders))
	for i := range orders {
		ordersPtr[i] = &orders[i]
	}
	sortOrders(ordersPtr)

	metricsRecordMu.Lock()
	regionStart := 0
	for regionStart < len(ordersPtr) {
		regionId := orders[regionStart].RegionId
		regionEnd := getRegionEnd(orders, regionId, regionStart)
		regionOrders := ordersPtr[regionStart:regionEnd]

		typeStart := 0
		for typeStart < len(regionOrders) {
			if err := ctx.Err(); err != nil {
				return err
			}

			typeId := regionOrders[typeStart].TypeId
			typeSellStart, typeEnd := getTypeSellStartAndEnd(regionOrders, typeId, typeStart)
			buyOrders := regionOrders[typeStart:typeSellStart]
			sellOrders := regionOrders[typeSellStart:typeEnd]

			market := market{typeId: typeId, regionId: regionId}
			metrics := metricsRecord[today][market] // can be zero
			setMarketMetrics(today, market, marketMetrics{
				buyPrice:        (computeBuyPriceFromOrders(buyOrders) + metrics.buyPrice*metrics.buyPriceWeight) / (metrics.buyPriceWeight + 1),
				buyPriceWeight:  metrics.buyPriceWeight + 1,
				sellPrice:       (computeSellPriceFromOrders(sellOrders) + metrics.sellPrice*metrics.sellPriceWeight) / (metrics.sellPriceWeight + 1),
				sellPriceWeight: metrics.sellPriceWeight + 1,
			})

			if typeEnd <= typeStart {
				panic("infinite loop?")
			}
			typeStart = typeEnd
		}

		if regionEnd <= regionStart {
			panic("infinite loop?")
		}
		regionStart = regionEnd
	}
	metricsRecordMu.Unlock()

	return nil
}

// `histories` contains all histories of typeId
// This function is meant to be called during the global histories computation
func ComputeDayDataPoints(ctx context.Context, typeId int, histories []dbHistory, today time.Time) ([]DayDataPoint, error) {
	utils.AssertIsDate(today)
	yesterday := today.AddDate(0, 0, -1)
	if len(histories) == 0 {
		return nil, nil
	}

	dayDataPoints := make([]DayDataPoint, 0, len(histories)+1)
	metricsRecordMu.RLock()
	for _, history := range histories {
		if history.TypeId != typeId {
			panic("histories are not of the same typeId")
		}
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		dayDataPoint, err := computeRegionDayDataPointOfType(history, yesterday)
		if err != nil {
			return nil, fmt.Errorf("compute day dp: %w", err)
		}
		if dayDataPoint != nil {
			dayDataPoints = append(dayDataPoints, *dayDataPoint)
		}
	}
	metricsRecordMu.RUnlock()
	if len(dayDataPoints) > 0 {
		globalDataPoint := computeGlobalDayDataPointOfType(dayDataPoints, yesterday, typeId)
		dayDataPoints = append(dayDataPoints, globalDataPoint)
	}

	return dayDataPoints, nil
}

func InsertDayDataPoints(ctx context.Context, dayDataPoints []DayDataPoint) error {
	return dbInsertDayDataPoints(ctx, dayDataPoints)
}

func ClearBefore(today time.Time) {
	utils.AssertIsDate(today)
	metricsRecordMu.Lock()
	for d := range metricsRecord {
		if d.Before(today) {
			delete(metricsRecord, d)
		}
	}
	metricsRecordMu.Unlock()
}

// WARN: nillable return value
func computeRegionDayDataPointOfType(history dbHistory, yesterday time.Time) (*DayDataPoint, error) {
	utils.AssertIsDate(yesterday)
	market := market{typeId: history.TypeId, regionId: history.RegionId}
	metrics, ok := metricsRecord[yesterday][market]
	if !ok {
		return nil, nil
	}

	historyDay, err := getHistoryDay(history, yesterday)
	if err != nil {
		return nil, fmt.Errorf("getHostiryDay: %w", err)
	}
	if historyDay == nil {
		return nil, nil
	}

	return &DayDataPoint{
		typeId:    history.RegionId,
		regionId:  history.TypeId,
		date:      yesterday,
		volume:    historyDay.Volume,
		sellPrice: metrics.sellPrice,
		buyPrice:  metrics.buyPrice,
	}, nil
}

func computeGlobalDayDataPointOfType(dayDataPoints []DayDataPoint, yesterday time.Time, typeId int) DayDataPoint {
	utils.AssertIsDate(yesterday)
	var sellPrice, buyPrice float64 = 0, 0
	var volume float64 = 0

	for _, dp := range dayDataPoints {
		if dp.volume > 0 {
			// weighted average
			sellPrice = (volume*sellPrice + dp.sellPrice*float64(dp.volume)) / (volume + float64(dp.volume))
			buyPrice = (volume*buyPrice + dp.buyPrice*float64(dp.volume)) / (volume + float64(dp.volume))
			volume += float64(dp.volume)
		}
	}

	return DayDataPoint{
		typeId:    typeId,
		regionId:  0,
		date:      yesterday,
		volume:    int64(volume),
		sellPrice: sellPrice,
		buyPrice:  buyPrice,
	}
}

func unmarshalHistory(history []byte) ([]esiHistoryDay, error) {
	var esiHistory []esiHistoryDay
	err := json.Unmarshal(history, &esiHistory)
	if err != nil {
		return nil, err
	}
	return esiHistory, nil
}

// return nil history day if not found
// WARN: nillable return value
func getHistoryDay(history dbHistory, yesterday time.Time) (*esiHistoryDay, error) {
	unmarshaledHistory, err := unmarshalHistory(history.History)
	if err != nil {
		return nil, fmt.Errorf("invalid json from db: %w", err)
	}

	esiDate := yesterday.Format(esi.DateLayout)
	for i := len(unmarshaledHistory) - 1; i >= 0; i-- {
		if unmarshaledHistory[i].Date == esiDate {
			historyDay := unmarshaledHistory[i] // to allow the gc to free unmarshaledHistory
			return &historyDay, nil
		}
	}
	return nil, nil
}

func getRegionEnd(orders []dbOrder, regionId int, regionStart int) int {
	regionEnd := regionStart
	for i := regionStart; i < len(orders); i++ {
		if orders[i].RegionId != regionId {
			break
		}
		regionEnd++
	}
	if regionEnd == regionStart {
		panic("hummmmm")
	}
	return regionEnd
}

func getTypeSellStartAndEnd(orders []*dbOrder, typeId int, typeStart int) (int, int) {
	typeEnd := typeStart
	typeSellStart := typeStart
	for i := typeStart; i < len(orders); i++ {
		if orders[typeEnd].TypeId != typeId {
			break
		}
		if orders[typeEnd].IsBuyOrder {
			typeSellStart++
		}
		typeEnd++
	}
	if typeSellStart < typeStart || typeSellStart > typeEnd || typeEnd == typeStart {
		panic("hummmmmm")
	}
	return typeSellStart, typeEnd
}

// highest buy
func computeBuyPriceFromOrders(orders []*dbOrder) float64 {
	if len(orders) == 0 {
		return 0
	}
	if !orders[0].IsBuyOrder {
		panic("hummm")
	}
	lowest := orders[0].Price
	for _, o := range orders {
		if !o.IsBuyOrder {
			panic("hummmm")
		}
		if o.Price > lowest {
			lowest = o.Price
		}
	}
	return lowest
}

// lowest sell
func computeSellPriceFromOrders(orders []*dbOrder) float64 {
	if len(orders) == 0 {
		return 0
	}
	if orders[0].IsBuyOrder {
		panic("hummm")
	}
	lowest := orders[0].Price
	for _, o := range orders {
		if o.IsBuyOrder {
			panic("hummmm")
		}
		if o.Price < lowest {
			lowest = o.Price
		}
	}
	return lowest
}

// natural sort of orders over (RegionId, TypeId, IsBuyOrder)
func sortOrders(orders []*dbOrder) {
	sort.Slice(orders, func(i, j int) bool {
		return (orders[i].RegionId < orders[j].RegionId ||
			orders[i].RegionId == orders[j].RegionId && orders[i].TypeId < orders[j].TypeId ||
			orders[i].RegionId == orders[j].RegionId && orders[i].TypeId == orders[j].TypeId && orders[i].IsBuyOrder && !orders[j].IsBuyOrder)
	})
}

func setMarketMetrics(today time.Time, market_ market, metrics marketMetrics) {
	dateRecord, ok := metricsRecord[today]
	if !ok {
		metricsRecord[today] = make(map[market]marketMetrics)
		dateRecord = metricsRecord[today]
	}
	dateRecord[market_] = metrics
}
