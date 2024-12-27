package locations

import (
	"context"
	"database/sql"
	"time"
)

func dbGetUnknownLocations(ctx context.Context) ([]int, error) {
	readDB := ctx.Value("readDB").(*sql.DB)
	unknownLocations := make([]int, 0)
  timeoutCtx, cancel := context.WithTimeout(ctx, 5 * time.Minute)
  defer cancel()

	selectQuery := `
  SELECT DISTINCT o.LocationId FROM "Order" o
    LEFT JOIN Location l ON o.LocationId = l.Id
    WHERE l.Id IS NULL
    AND o.LocationId >= 60000000 AND o.LocationId <= 64000000;
  `
	rows, err := readDB.QueryContext(timeoutCtx, selectQuery)
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
	writeDB := ctx.Value("writeDB").(*sql.DB)
  timeoutCtx, cancel := context.WithTimeout(ctx, 10 * time.Minute)
  defer cancel()

	tx, err := writeDB.BeginTx(timeoutCtx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(timeoutCtx, "INSERT INTO Location VALUES (?,?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, l := range locations {
		_, err = stmt.ExecContext(timeoutCtx, l.Id, l.Name)
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
