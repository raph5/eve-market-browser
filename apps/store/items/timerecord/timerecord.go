package timerecord

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/lib/database"
)

func Set(ctx context.Context, key string, expTime time.Time) error {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	insertQuery := "INSERT OR REPLACE INTO TimeRecord VALUES (?,?)"
	_, err := db.Exec(timeoutCtx, insertQuery, key, expTime.Unix())
	if err != nil {
		return err
	}

	return nil
}

func Get(ctx context.Context, key string) (time.Time, error) {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	var unixTime int64
	selectQuery := `SELECT Time FROM TimeRecord WHERE "Key" = ?`
	err := db.QueryRow(timeoutCtx, selectQuery, key).Scan(&unixTime)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return time.Now().Add(-1 * time.Second), nil
		}
		return time.Time{}, err
	}

	return time.Unix(unixTime, 0), nil
}
