package main

import (
	"context"
	"database/sql"
)

type activeType struct {
  typeId int
  regionId int
}

func populateActiveTypes(ctx context.Context) error {
  writeDB := ctx.Value("writeDB").(*sql.DB)
  populateQuery := `
  INSERT OR IGNORE INTO ActiveType
    SELECT DISTINCT TypeId, RegionId FROM "Order";
  `
  _, err := writeDB.Exec(populateQuery)
  if err != nil {
    return err
  }

  return nil
}

func getActiveTypes(ctx context.Context, offset int, limit int) ([]activeType, error) {
  readDB := ctx.Value("readDB").(*sql.DB)
  activeTypes := make([]activeType, 0, limit)
  
  rows, err := readDB.Query("SELECT TypeId, RegionId FROM ActiveType LIMIT ? OFFSET ?", limit, offset)
  if err != nil {
    return nil, err
  }
  defer rows.Close()

  for rows.Next() {
    activeTypes = activeTypes[:len(activeTypes)+1]
    at := &activeTypes[len(activeTypes)-1]
    err = rows.Scan(&at.typeId, &at.regionId)
    if err != nil {
      return nil, err
    }
  }

  err = rows.Err()
  if err != nil {
    return nil, err
  }

  return activeTypes, nil
}
