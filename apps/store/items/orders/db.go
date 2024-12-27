package orders

import (
	"context"
	"database/sql"
	"time"
)

// how orders are stored in db
type dbOrder struct {
	Duration     int
	IsBuyOrder   bool
	Issued       string
	LocationId   int
	MinVolume    int
	OrderId      int
	Price        float64
	Range        string
	RegionId     int
	SystemId     int
	TypeId       int
	VolumeRemain int
	VolumeTotal  int
}

// TODO: add an intermediate representation for ranges as int for tighter storage
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

func dbReplaceOrdersFromRegion(ctx context.Context, regionId int, orders []dbOrder) error {
	writeDB := ctx.Value("writeDB").(*sql.DB)
  timeoutCtx, cancel := context.WithTimeout(ctx, 5 * time.Minute)
  defer cancel()
  
	tx, err := writeDB.BeginTx(timeoutCtx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(timeoutCtx, "DELETE FROM `Order` WHERE RegionId = ?", regionId)
	if err != nil {
		return err
	}

	stmt, err := tx.PrepareContext(timeoutCtx, "INSERT OR REPLACE INTO `Order` VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

  for _, o := range orders {
    if o.RegionId != regionId {
      panic("dbReplaceOrdersFromRegion invalid input")
    }
    _, err := stmt.ExecContext(
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
