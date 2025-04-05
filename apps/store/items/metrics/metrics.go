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
