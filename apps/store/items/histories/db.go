package histories

import (
	"context"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/lib/database"
)

type dbHistory struct {
	history  []byte
	typeId   int
	regionId int
}

type dbHistoryDay struct {
	Date           string  `json:"date"`
	Average        float64 `json:"average"`
	Average5d      float64 `json:"average5d"`
	Average20d     float64 `json:"average20d"`
	Highest        float64 `json:"highest"`
	Lowest         float64 `json:"lowest"`
	OrderCount     int     `json:"orderCount"`
	Volume         int     `json:"volume"`
	DonchianTop    float64 `json:"donchianTop"`
	DonchianBottom float64 `json:"donchianBottom"`
}

func dbGetHistoriesOfType(ctx context.Context, typeId int) ([]dbHistory, error) {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	selectQuery := `
  SELECT HistoryJson, RegionId FROM History WHERE TypeId = ? AND RegionId != 0`
	rows, err := db.Query(timeoutCtx, selectQuery, typeId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	histories := make([]dbHistory, 0)
	for rows.Next() {
		var h = dbHistory{typeId: typeId}
		err = rows.Scan(&h.history, &h.regionId)
		if err != nil {
			return nil, err
		}
		histories = append(histories, h)
	}

	err = rows.Err()
	if err != nil {
		return nil, err
	}

	return histories, nil
}

func dbInsertHistories(ctx context.Context, histories []dbHistory) error {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	// NOTE: the transaction here is not strictly necessary, if it lock the db
	// for too long I may to remove it.
	tx, err := db.Begin(timeoutCtx)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	stmt, err := tx.PrepareWrite(timeoutCtx, "INSERT OR REPLACE INTO History VALUES (?,?,?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, h := range histories {
		_, err = stmt.Exec(timeoutCtx, h.typeId, h.regionId, h.history)
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}

func dbInsertHistory(ctx context.Context, history dbHistory) error {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 4*time.Minute)
	defer cancel()

	insertQuery := "INSERT OR REPLACE INTO History VALUES (?,?,?)"
	_, err := db.Exec(timeoutCtx, insertQuery, history.typeId, history.regionId, history.history)
	if err != nil {
		return err
	}

	return nil
}
