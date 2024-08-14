package main

import (
	"context"
	"database/sql"

	"github.com/raph5/eve-market-browser/apps/store/esi"
)

type esiName struct {
  Id   int    `json:"id"`
  Name string `json:"name"`
}

func downloadLocations(ctx context.Context) error {
  writeDB := ctx.Value("writeDB").(*sql.DB)
  readDB := ctx.Value("readDB").(*sql.DB)

  selectUnkownLocations := `
  SELECT DISTINCT o.LocationId FROM "Order" o
    LEFT JOIN Location l ON o.LocationId = l.Id
    WHERE l.Id IS NULL
    AND o.LocationId >= 60000000 AND o.LocationId <= 64000000;
  `
  rows, err := readDB.Query(selectUnkownLocations)
  if err != nil {
    return err
  }
  defer rows.Close()

  unknownLocations := make([]int, 0)
  var locationId int
  for rows.Next() {
    err := rows.Scan(&locationId)
    if err != nil {
      return err
    }
    unknownLocations = append(unknownLocations, locationId)
  }
  err = rows.Err()
  if err != nil {
    return err
  }

  namesData := make([]esiName, 0)
  for i := 0; i < len(unknownLocations); i += 1000 {
    chunk := unknownLocations[i:min(i+1000, len(unknownLocations))]
    namesDataChunk, err := esi.EsiFetch[[]esiName](ctx, "/universe/names", "POST", nil, chunk, 1, 5)
    if err != nil {
      return err
    }
    namesData = append(namesData, namesDataChunk...)
  }

  // write out the locations to db
  tx, err := writeDB.Begin()
  if err != nil {
    return err
  }
  defer tx.Rollback()

  stmt, err := tx.Prepare("INSERT INTO Location VALUES (?,?)")
  if err != nil {
    return err
  }
  defer stmt.Close()

  for _, n := range namesData {
    _, err = stmt.Exec(n.Id, n.Name)
  }

  err = tx.Commit()
  if err != nil {
    return err
  }

  return nil
}
