package metrics

import (
	"context"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/lib/database"
)

func dbInsertHotTypeDataPoint(ctx context.Context, dp hotTypeDataPoint) error {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()

	insertQuery := "INSERT INTO HotTypeMetric VALUES (?,?,?,?)"
	_, err := db.Exec(timeoutCtx, insertQuery, dp.typeId, dp.time.Unix(), dp.buyPrice, dp.sellPrice)
	if err != nil {
		return err
	}

	return nil
}

func dbInsertDayTypeDataPoint(ctx context.Context, dp dayTypeDataPoint) error {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()

	year, day := dateToYearAndDay(dp.date)

	insertQuery := "INSERT INTO HotTypeMetric VALUES (?,?,?,?,?,?,?)"
	_, err := db.Exec(timeoutCtx, insertQuery, dp.typeId, year, day, dp.buyPrice, dp.sellPrice, dp.buyVolume, dp.buyVolume)
	if err != nil {
		return err
	}

	return nil
}
