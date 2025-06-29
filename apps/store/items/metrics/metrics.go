// Metrics is the package responsible for providing api to compute, store and
// retrive time series metrics that are computes using data available in db (no
// external request a priori)
//
// Storage of metics will happen in two tables: HotTypeMetric and DayTypeMetric
// HotTypeMetric will handle metrics with frequent new data points (like every
// 10 minutes)
// DayTypeMetric will handle metrics that will get a new data point every day
// (like average of some HotMetrics for example)
// HotTypeMetric table will be burned to the ground every 1 to 2 days to avoid
// exessive memory consumption
//
// If I latter need to add global metrics they will be added under the
// HotGlobalMetric and DayGlobalMetric tables
//
// NOTE: DayTypeMetric is a bit of a diplicate of History. One day I could
// perhaps merge this two tables

package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/items/shared"
	"github.com/raph5/eve-market-browser/apps/store/lib/esi"
)

type dbOrder = shared.DbOrder
type dbHistory = shared.DbHistory
type esiHistoryDay = shared.EsiHistoryDay

type hotDataPoint struct {
	typeId    int
	regionId  int
	time      time.Time
	sellPrice float64
	buyPrice  float64
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

// Compute and store HotDataPoints relative and ordersList
// retrivalTime is the time at wich the data was up to date
// This function is meant to be called during the orders download process
func CreateHotDataPoints(ctx context.Context, retrivalTime time.Time, orders []dbOrder) error {
	dataPoints, err := computeHotDataPoints(ctx, retrivalTime, orders)
	if err != nil {
		return err
	}
	err = dbInsertHotDataPoints(ctx, dataPoints)
	if err != nil {
		return err
	}
	return nil
}

func ClearHotDataPoints(ctx context.Context, day time.Time) error {
	elevenToday := elevenThatDay(day)
	return dbClearHotTypeDataPoints(ctx, elevenToday)
}

// histories contains all histories of a typeId
// This function is meant to be called during the global histories computation
func CreateRegionDayDataPoints(ctx context.Context, histories []dbHistory, day time.Time) ([]DayDataPoint, error) {
	if len(histories) == 0 {
		return nil, nil
	}
	typeId := histories[0].TypeId

	elevenToday := elevenThatDay(day)
	elevenYesterday := elevenTheDayBefore(day)
	// hotDataPoints of typeId for all regions sorted by regionId
	hotDataPoints, err := dbGetHotDataPointOfTypeId(ctx, typeId, elevenYesterday, elevenToday)
	if err != nil {
		return nil, fmt.Errorf("get day dp: %w", err)
	}

	dayDataPoints := make([]DayDataPoint, 0, len(histories)+1)
	for _, history := range histories {
		if history.TypeId != typeId {
			panic("histories are not of the same typeId")
		}
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		hotDataPoints := getRegionDataPoints(hotDataPoints, history.RegionId)
		dayDataPoint, err := computeRegionDayDataPointOfType(hotDataPoints, history, day)
		if err != nil {
			return nil, fmt.Errorf("compute day dp: %w", err)
		}
		if dayDataPoint != nil {
			dayDataPoints = append(dayDataPoints, *dayDataPoint)
		}
	}
	if len(dayDataPoints) > 0 {
		globalDataPoint := computeGlobalDayDataPointOfType(dayDataPoints, day, typeId)
		dayDataPoints = append(dayDataPoints, globalDataPoint)
	}

	return dayDataPoints, nil
}

func InsertDayDataPoints(ctx context.Context, dayDataPoints []DayDataPoint) error {
	return dbInsertDayDataPoints(ctx, dayDataPoints)
}

func computeHotDataPoints(ctx context.Context, retrivalTime time.Time, orders []dbOrder) ([]hotDataPoint, error) {
	dataPoints := make([]hotDataPoint, 0, 1024)
	ordersPtr := make([]*dbOrder, len(orders))
	for i := range orders {
		ordersPtr[i] = &orders[i]
	}
	sortOrders(ordersPtr)

	regionStart := 0
	for regionStart < len(ordersPtr) {
		regionId := orders[regionStart].RegionId
		regionEnd := getRegionEnd(orders, regionId, regionStart)
		if regionEnd == regionStart {
			panic("hummmmm")
		}
		regionOrders := ordersPtr[regionStart:regionEnd]

		typeStart := 0
		for typeStart < len(regionOrders) {
			if err := ctx.Err(); err != nil {
				return nil, err
			}

			typeId := regionOrders[typeStart].TypeId
			typeSellStart, typeEnd := getTypeSellStartAndEnd(regionOrders, typeId, typeStart)
			if typeSellStart < typeStart || typeSellStart > typeEnd || typeEnd == typeStart {
				panic("hummmmmm")
			}
			buyOrders := regionOrders[typeStart:typeSellStart]
			sellOrders := regionOrders[typeSellStart:typeEnd]

			buyPrice := computeBuyPriceFromOrders(buyOrders)
			sellPrice := computeSellPriceFromOrders(sellOrders)
			dataPoints = append(dataPoints, hotDataPoint{
				typeId:    typeId,
				regionId:  regionId,
				time:      retrivalTime,
				buyPrice:  buyPrice,
				sellPrice: sellPrice,
			})

			typeStart = typeEnd
		}

		regionStart = regionEnd
	}

	return dataPoints, nil
}

// WARN: nillable return value
func computeRegionDayDataPointOfType(regionDataPoints []hotDataPoint, history dbHistory, day time.Time) (*DayDataPoint, error) {
	if len(regionDataPoints) == 0 {
		return nil, nil
	}

	historyDay, err := getHistoryDay(history, day)
	if err != nil {
		return nil, fmt.Errorf("getHostiryDay: %w", err)
	}
	if historyDay == nil {
		return nil, nil
	}

	var sellPrice, buyPrice float64 = 0, 0
	for _, dp := range regionDataPoints {
		sellPrice += dp.sellPrice
		buyPrice += dp.buyPrice
	}
	sellPrice /= float64(len(regionDataPoints))
	buyPrice /= float64(len(regionDataPoints))

	return &DayDataPoint{
		typeId:    history.RegionId,
		regionId:  history.TypeId,
		date:      day,
		volume:    historyDay.Volume,
		sellPrice: sellPrice,
		buyPrice:  buyPrice,
	}, nil
}

func computeGlobalDayDataPointOfType(dayDataPoints []DayDataPoint, day time.Time, typeId int) DayDataPoint {
	var sellPrice, buyPrice float64 = 0, 0
	var volume float64 = 0

	// weighted average
	for _, dp := range dayDataPoints {
		if dp.volume > 0 {
			sellPrice = (volume*sellPrice + dp.sellPrice*float64(dp.volume)) / (volume + float64(dp.volume))
			buyPrice = (volume*buyPrice + dp.buyPrice*float64(dp.volume)) / (volume + float64(dp.volume))
			volume += float64(dp.volume)
		}
	}

	return DayDataPoint{
		typeId:    typeId,
		regionId:  0,
		date:      day,
		volume:    int64(volume),
		sellPrice: sellPrice,
		buyPrice:  buyPrice,
	}
}

// WARN: dataPoints most be grouped by regionId
func getRegionDataPoints(dataPoints []hotDataPoint, regionId int) []hotDataPoint {
	var start, end int
	for start = 0; start < len(dataPoints); start++ {
		if dataPoints[start].regionId == regionId {
			break
		}
	}
	for end = start; end < len(dataPoints); end++ {
		if dataPoints[end].regionId != regionId {
			break
		}
	}
	return dataPoints[start:end]
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
func getHistoryDay(history dbHistory, day time.Time) (*esiHistoryDay, error) {
	unmarshaledHistory, err := unmarshalHistory(history.History)
	if err != nil {
		return nil, fmt.Errorf("invalid json from db: %w", err)
	}

	esiDay := day.Format(esi.DateLayout)
	for i := len(unmarshaledHistory) - 1; i >= 0; i-- {
		if unmarshaledHistory[i].Date == esiDay {
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

func elevenThatDay(date time.Time) time.Time {
	return time.Date(date.Year(), date.Month(), date.Day(), 11, 0, 0, 0, date.Location())
}

func elevenTheDayBefore(date time.Time) time.Time {
	return time.Date(date.Year(), date.Month(), date.Day()-1, 11, 0, 0, 0, date.Location())
}
