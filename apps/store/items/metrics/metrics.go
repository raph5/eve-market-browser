// Metrics is the package responsible for providing api to compute, store and
// retrive time series metrics that are computes using data available in db (no
// external request a priori)
//
// Storage of metics will appen in two tables: HotTypeMetric and DayTypeMetric
// HotTypeMetric will handle metrics with frequent new data points (like every 10
// minutes)
// DayTypeMetric will handle metrics that will get a new data point every day (like
// average of some HotMetrics for example)
// HotTypeMetric table will be burned to the ground every 1 to 2 days to avoid
// exessive memory consumption
//
// If I latter need to add global metrics they will be added under the
// HotGlobalMetric and DayGlobalMetric tables

package metrics

import (
	"time"
	"fmt"
)

type hotTypeDataPoint struct {
	typeId int
	time time.Time
	sellPrice float32
	buyPrice float32
}

type dayTypeDataPoint struct {
	typeId int
	date time.Time
	sellPrice float32
	buyPrice float32
	sellVolume float32
	buyVolume float32
}

// dpTime is the time at wich the data was up to date
// ordersCh is meant to retrive all fetched orders from orders.Download
// WARN: orders must be grouped by regions
func ComputeHotDataPoints(ctx context.Context, retrivalTime time.Time, ordersCh <-chan []dbOrder) error {
	orders := <-ordersCh

	dataPoints := make([]hotDataPoint, 0, 1024)
	ordersPtr := make([]*dbOrder, len(orders))
	for i := range orders {
		ordersPtr[i] = &orders[i]
	}

	regionStart := 0
	for _, regionId := range regions.Regions {
		regionEnd := getRegionEnd(orders, regionId, regionStart)
		if regionEnd == regionStart {
			continue
		}
		regionOrders := ordersPtr[regionStart:regionEnd]
		sortOrders(regionOrders)

		typeStart := 0
		for typeStart < regionEnd {
			typeId := regionOrders[typeStart].TypeId
			typeSellStart, typeEnd := getTypeSellStartAndEnd(orders, typeId, typeStart)
			buyOrders := regionOrders[typeStart:typeSellStart]
			sellOrders := regionOrders[typeSellStart:typeEnd]
			buyPrice := computeBuyPriceFromOrders(buyOrders)
			sellPrice := computeSellPriceFromOrders(sellOrders)

			dataPoints = append(dataPoints, hotDataPoint{
				typeId: typeId,
				regionId: regionId,
				time: retrivalTime,
				buyPrice: buyPrice,
				sellPrice: sellPrice,
			})

			typeStart = typeEnd
		}
	}

	err := dbInsertHotDataPoints(ctx, dataPoints)
	if err != nil {
		return err
	}

	return nil
}

func ClearHotDataPoints(ctx context.Context, before time.Time) error {
	return dbClearHotTypeDataPoints(ctx, before)
}

// historiesCh is meant to recive histories packed by typeId from
// histories.ComputeGobalHistories
func ComputeDayDataPoints(ctx context.Context, after time.Time, before time.Time, historiesCh <-chan []dbHistory) error {
	for histories := range historiesCh {
		typeId := histories[0].TypeId

		hotDataPoints, err := dbGetHotDataPointOfTypeId(ctx, typeId, after, before)
		if err != nil {
			return err
		}
		dayDataPoints := computeDayDataPointsOfType(ctx, typeId, hotDataPoints, histories)
		err = dbInsertDayDataPoints(ctx, dayDataPoints)
		if err != nil {
			return err
		}
	}

	return nil
}

func computeDayDataPointsOfType(ctx context.Context, typeId int, dataPoints []hotDataPoint, histories []dbHistory) []dayDataPoint {
	dayDataPoints := make([]dayDataPoint, 0, 16)

	regionStart := 0
	for regionStart < len(dataPoints) {
		dbHistory := getHistoryOfRegion(histories)
		unmarshaledHistory := histories.UnmarshalHistory(histories)
		regionId := dataPoints[regionStart].regionId
		regionEnd := dataPointsGetRegionEnd(dataPoints, regionId, regionStart)
		regionDataPoints := dataPoints[regionStart:regionEnd]
	}

	return nil
}

func getHistoryOfRegion(histories []dbHistory, regionId int) dbHistory {
	for _, historiy := range histories {
		if historiy.RegionId == regionId {
			return historiy
		}
	}
	panic("I could not find the history you asked for 😔")
}

func getRegionEnd(orders []dbOrder, regionId int, regionStart int) int {
	var regionEnd int
	for regionEnd = regionStart; regionEnd < len(orders); regionEnd++ {
		if orders[regionEnd].RegionId != regionId {
			break
		}
	}
	return regionEnd
}

func getTypeSellStartAndEnd(orders []dbOrder, typeId int, typeStart int) (int, int) {
	var typeEnd int
	var typeSellStart = typeStart
	for typeEnd = typeStart; typeEnd < len(orders); typeEnd++ {
		if orders[typeEnd].IsBuyOrder {
			typeSellStart++
		}
		if orders[typeEnd].TypeId != typeId {
			break
		}
	}
	return typeSellStart, typeEnd
}

func dataPointsGetRegionEnd(dataPoints []hotDataPoint, regionId int, regionStart int) int {
	var regionEnd int
	for regionEnd = regionStart; regionEnd < len(dataPoints); regionEnd++ {
		if dataPoints[regionEnd].regionId != regionId {
			break
		}
	}
	return regionEnd
}

// 5% volume weighted buy price
func computeBuyPriceFromOrders(orders []*dbOrder) float32 {
	var totalVolume float32 = 0
	for _, o := range orders {
		totalVolume += float32(o.VolumeRemain)
	}

	var volume float32 = 0
	for i := len(orders)-1; i >= 0; i++ {
		volume += float32(orders[i].VolumeRemain)
		if volume > 0.05 * totalVolume {
			return float32(orders[i].Price)
		}
	}

	panic("how did you end here 🤭")
}

// 5% volume weighted sell price
func computeSellPriceFromOrders(orders []*dbOrder) float32 {
	var totalVolume float32 = 0
	for _, o := range orders {
		totalVolume += float32(o.VolumeRemain)
	}

	var volume float32 = 0
	for i := range orders {
		volume += float32(orders[i].VolumeRemain)
		if volume > 0.05 * totalVolume {
			return float32(orders[i].Price)
		}
	}

	panic("how did you end here 🤭")
}

// NOTE: Here we assume an homogeneous repartition of the volume of trades over
// the day (which is not the case)
func computeSellPriceFromHotDataPoints(dataPoints []hotDataPoint) float32

// NOTE: Here we assume an homogeneous repartition of the volume of trades over
// the day (which is not the case)
func computeBuyPriceFromHotDataPoints(dataPoints []hotDataPoint) float32

// natural sort of orders over (TypeId, IsBuyOrder, Price)
func sortOrders(orders []*dbOrder) {
	sort.Slice(orders, func(i, j int) bool {
		return (orders[i].TypeId < orders[j].TypeId ||
			orders[i].TypeId == orders[j].TypeId && orders[i].IsBuyOrder && !orders[j].IsBuyOrder ||
			orders[i].TypeId == orders[j].TypeId && orders[i].IsBuyOrder == orders[j].IsBuyOrder && orders[i].Price < orders[j].Price)
	})
}

func yearAndDayToDate(year int, day int) time.Time {
	ordinalDate := fmt.Sprintf("%04d-%03d", year, day)
	date, err := time.Parse("2006-002", ordinalDate)
	if err != nil {
		panic(fmt.Sprintf("impossible to format the date: %s", ordinalDate))
	}
	return date
}

func dateToYearAndDay(date time.Time) (int, int) {
	return date.Year(), date.YearDay()
}
