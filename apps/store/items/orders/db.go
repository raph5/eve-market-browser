package orders

import (
	"context"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/items/shared"
	"github.com/raph5/eve-market-browser/apps/store/lib/database"
)

// how orders are stored in db
type dbOrder = shared.DbOrder

// NOTE: I could add an intermediate representation for ranges as int for
// tighter storage. But the orders weight only ~200mb against ~10gb for the
// price histories which is quite negligible.
var esiToDbRangeMap = map[string]string{
	"station":     "Station",
	"region":      "Region",
	"solarsystem": "Solar System",
	"1":           "1 Jumps",
	"2":           "2 Jumps",
	"3":           "3 Jumps",
	"4":           "4 Jumps",
	"5":           "5 Jumps",
	"10":          "10 Jumps",
	"20":          "20 Jumps",
	"30":          "30 Jumps",
	"40":          "40 Jumps",
}

func dbReplaceOrders(ctx context.Context, orders []dbOrder) error {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	tx, err := db.Begin(timeoutCtx)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(timeoutCtx, "DELETE FROM `Order`")
	if err != nil {
		return err
	}

	stmt, err := tx.PrepareWrite(timeoutCtx, "INSERT OR REPLACE INTO `Order` VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, o := range orders {
		_, err := stmt.Exec(
			timeoutCtx,
			o.OrderId,
			o.RegionId,
			o.Duration,
			o.IsBuyOrder,
			o.Issued,
			o.LocationId,
			o.MinVolume,
			o.Price,
			o.Range,
			o.SystemId,
			o.TypeId,
			o.VolumeRemain,
			o.VolumeTotal,
		)
		if err != nil {
			return err
		}
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return err
}
