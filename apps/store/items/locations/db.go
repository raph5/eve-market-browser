package locations

import (
	"context"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/lib/database"
)

func dbGetUnknownLocations(ctx context.Context) ([]int, error) {
	db := ctx.Value("db").(*database.DB)
	unknownLocations := make([]int, 0)
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	selectQuery := `
  SELECT DISTINCT o.LocationId FROM "Order" o
    LEFT JOIN Location l ON o.LocationId = l.Id
    WHERE l.Id IS NULL
    AND o.LocationId >= 60000000 AND o.LocationId <= 64000000;
  `
	rows, err := db.Query(timeoutCtx, selectQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var locationId int
	for rows.Next() {
		err := rows.Scan(&locationId)
		if err != nil {
			return nil, err
		}
		unknownLocations = append(unknownLocations, locationId)
	}
	err = rows.Err()
	if err != nil {
		return nil, err
	}

	return unknownLocations, nil
}

func dbAddLocations(ctx context.Context, locations []nameAndId) error {
	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	// NOTE: the transaction here is not strictly necessary, if it lock the db
	// for too long I may to remove it.
	tx, err := db.Begin(timeoutCtx)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareWrite(timeoutCtx, "INSERT INTO Location VALUES (?,?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, l := range locations {
		_, err = stmt.Exec(timeoutCtx, l.Id, l.Name)
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
