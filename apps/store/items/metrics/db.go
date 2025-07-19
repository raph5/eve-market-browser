package metrics

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/lib/database"
)

func dbGetItemStats(ctx context.Context, typeId int, regionId int, date time.Time) (*apiItemStats, error) {
	stats := apiItemStats{TypeId: typeId, RegionId: regionId}

	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()

	query := `
  SELECT Volume, SellPrice, BuyPrice FROM DayTypeMetric
    WHERE RegionId = ? AND TypeId = ? AND Date = ?;
  `
	err := db.QueryRow(
		timeoutCtx,
		query,
		regionId,
		typeId,
		date,
	).Scan(&stats.Volume, &stats.SellPrice, &stats.BuyPrice)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	query = `
  SELECT AVG(Volume), AVG(SellPrice), AVG(BuyPrice) FROM DayTypeMetric
    WHERE RegionId = ? AND TypeId = ? AND Date BETWEEN ? AND ?;
  `
	err = db.QueryRow(
		timeoutCtx,
		query,
		regionId,
		typeId,
		date.AddDate(0, 0, -7).Format(dateLayout),
		date.AddDate(0, 0, -1).Format(dateLayout),
	).Scan(&stats.WeeklyVolume, &stats.WeeklySellPrice, &stats.WeeklyBuyPrice)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			stats.WeeklyVolume = -1
			stats.WeeklyBuyPrice = 0
			stats.WeeklySellPrice = 0
		} else {
			return nil, err
		}
	}

	return &stats, nil
}

// NOTE: It's important to wrap those inserts in a transaction to avoid the
// heavy work of updating the table index at each insert
func dbInsertDayDataPoints(ctx context.Context, dps []DayDataPoint) error {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 6*time.Minute)
	defer cancel()

	tx, err := db.Begin(timeoutCtx)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := "INSERT INTO DayTypeMetric VALUES (?,?,?,?,?,?)"
	stmt, err := tx.PrepareWrite(timeoutCtx, query)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, dp := range dps {
		_, err := stmt.Exec(timeoutCtx, query, dp.typeId, dp.regionId, dp.date, dp.buyPrice, dp.sellPrice, dp.volume)
		if err != nil {
			return err
		}
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}
