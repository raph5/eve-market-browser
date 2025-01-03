package histories

import (
	"context"
	"database/sql"
	"time"
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
	readDB := ctx.Value("readDB").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	selectQuery := `
  SELECT HistoryJson, RegionId FROM History WHERE TypeId = ? AND RegionId != 0`
	rows, err := readDB.QueryContext(timeoutCtx, selectQuery, typeId)
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
	writeDB := ctx.Value("writeDB").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	tx, err := writeDB.BeginTx(timeoutCtx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	stmt, err := tx.PrepareContext(timeoutCtx, "INSERT OR REPLACE INTO History VALUES (?,?,?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, h := range histories {
		_, err = stmt.ExecContext(timeoutCtx, h.typeId, h.regionId, h.history)
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}

func dbInsertHistory(ctx context.Context, history dbHistory) error {
	writeDB := ctx.Value("writeDB").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	insertQuery := "INSERT OR REPLACE INTO History VALUES (?,?,?)"
	_, err := writeDB.ExecContext(timeoutCtx, insertQuery, history.history, history.typeId, history.regionId)
	if err != nil {
		return err
	}

	return nil
}
