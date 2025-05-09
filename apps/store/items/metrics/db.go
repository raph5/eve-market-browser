package metrics

import (
	"context"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/lib/database"
)

func dbInsertHotDataPoints(ctx context.Context, dps []hotDataPoint) error {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 6*time.Minute)
	defer cancel()

	query := "INSERT INTO HotTypeMetric VALUES (?,?,?,?,?)"
	stmt, err := db.PrepareWrite(timeoutCtx, query)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, dp := range dps {
		_, err := stmt.Exec(timeoutCtx, dp.typeId, dp.regionId, dp.time.Unix(), dp.buyPrice, dp.sellPrice)
		if err != nil {
			return err
		}
	}

	return nil
}

func dbGetHotDataPointTypeIds(ctx context.Context, after time.Time, before time.Time) ([]int, error) {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()
	typeIds := make([]int, 0, 1024)

	query := `SELECT DISTINCT TypeId FROM HotTypeMetric
		WHERE Time >= ? AND Time < ?;`
	rows, err := db.Query(timeoutCtx, query, after.Unix(), before.Unix())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		typeIds = append(typeIds, 0)
		err = rows.Scan(typeIds[len(typeIds)-1])
		if err != nil {
			return nil, err
		}
	}

	err = rows.Err()
	if err != nil {
		return nil, err
	}

	return typeIds, nil
}

// The DataPoints returned are sorted by region
func dbGetHotDataPointOfTypeId(ctx context.Context, typeId int, after time.Time, before time.Time) ([]hotDataPoint, error) {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 6*time.Minute)
	defer cancel()
	dataPoints := make([]hotDataPoint, 0, 128)

	query := `SELECT RegionId, Time, BuyPrice, SellPrice FROM HotTypeMetric
		WHERE TypeId = ? AND Time >= ? AND Time < ?
		ORDER BY RegionId;`
	rows, err := db.Query(timeoutCtx, query, after.Unix(), before.Unix())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		dataPoints = append(dataPoints, hotDataPoint{typeId: typeId})
		dp := &dataPoints[len(dataPoints)-1]
		err = rows.Scan(dp.regionId, dp.time, dp.buyPrice, dp.sellPrice)
		if err != nil {
			return nil, err
		}
	}

	err = rows.Err()
	if err != nil {
		return nil, err
	}

	return dataPoints, nil
}

func dbClearHotTypeDataPoints(ctx context.Context, before time.Time) error {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()

	query := "DELETE FROM HotTypeMetric WHERE Time < ?"
	_, err := db.Exec(timeoutCtx, query, before.Unix())
	if err != nil {
		return err
	}

	return nil
}

func dbInsertDayDataPoints(ctx context.Context, dps []dayDataPoint) error {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 6*time.Minute)
	defer cancel()

	query := "INSERT INTO DayTypeMetric VALUES (?,?,?,?,?,?,?,?)"
	stmt, err := db.PrepareWrite(timeoutCtx, query)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, dp := range dps {
		year, day := dateToYearAndDay(dp.date)
		_, err := stmt.Exec(timeoutCtx, query, dp.typeId, dp.regionId, year, day, dp.buyPrice, dp.sellPrice, dp.volume)
		if err != nil {
			return err
		}
	}

	return nil
}
