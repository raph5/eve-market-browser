package main

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

func setExpirationTime(ctx context.Context, tableName string, expirationTime time.Time) error {
  writeDB := ctx.Value("writeDB").(*sql.DB)
  _, err := writeDB.Exec("INSERT OR REPLACE INTO TableExpiration VALUES (?,?)", tableName, expirationTime.Unix())
  if err != nil {
    return err
  }
  return nil
}

func getExpirationTime(ctx context.Context, tableName string) (time.Time, error) {
  readDB := ctx.Value("readDB").(*sql.DB)
  var unixExp int64
  row := readDB.QueryRow("SELECT ExpirationTime FROM TableExpiration WHERE TableName = ?", tableName)
  err := row.Scan(&unixExp)
  if err != nil {
    if errors.Is(err, sql.ErrNoRows) {
      return time.Now().Add(-1*time.Second), nil
    }
    return time.Time{}, err
  }
  return time.Unix(unixExp, 0), nil
}
