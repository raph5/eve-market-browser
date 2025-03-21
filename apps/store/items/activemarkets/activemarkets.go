// Active markets are the couples type, region for which we decide to fetch the
// history.

package activemarkets

import (
	"context"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/lib/database"
)

type ActiveMarket struct {
	TypeId   int
	RegionId int
}

func Populate(ctx context.Context) error {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	populateQuery := `
  INSERT OR IGNORE INTO ActiveMarket
    SELECT DISTINCT TypeId, RegionId FROM "Order";
  `
	_, err := db.Exec(timeoutCtx, populateQuery)
	if err != nil {
		return err
	}

	return nil
}

func Count(ctx context.Context) (int, error) {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	var count int
	err := db.QueryRow(timeoutCtx, "SELECT COUNT(*) FROM ActiveMarket").Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func GetTypesId(ctx context.Context) ([]int, error) {
	db := ctx.Value("db").(*database.DB)
	activeMarkets := make([]int, 0, 1024)
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	rows, err := db.Query(timeoutCtx, "SELECT DISTINCT TypeId FROM ActiveMarket")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		activeMarkets = append(activeMarkets, 0)
		err = rows.Scan(&activeMarkets[len(activeMarkets)-1])
		if err != nil {
			return nil, err
		}
	}

	err = rows.Err()
	if err != nil {
		return nil, err
	}

	return activeMarkets, nil
}

func GetChunk(ctx context.Context, offset int, limit int) ([]ActiveMarket, error) {
	db := ctx.Value("db").(*database.DB)
	activeMarkets := make([]ActiveMarket, 0, limit)
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	rows, err := db.Query(timeoutCtx, "SELECT TypeId, RegionId FROM ActiveMarket LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		activeMarkets = activeMarkets[:len(activeMarkets)+1]
		at := &activeMarkets[len(activeMarkets)-1]
		err = rows.Scan(&at.TypeId, &at.RegionId)
		if err != nil {
			return nil, err
		}
	}

	err = rows.Err()
	if err != nil {
		return nil, err
	}

	return activeMarkets, nil
}
