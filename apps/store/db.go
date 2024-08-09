// NOTE: The sqlite database config is based on this article
// https://kerkour.com/sqlite-for-servers
// Very good article btw

package main

import (
	"database/sql"

	_ "github.com/mattn/go-sqlite3"
)

func initDatabase() (*sql.DB, *sql.DB, error) {
  writeDB, err := sql.Open("sqlite3", "./data.db?_txlock=immediate")
  if err != nil {
    return nil, nil, err
  }
  writeDB.SetMaxOpenConns(1)

  readDB, err := sql.Open("sqlite3", "./data.db")
  if err != nil {
    return nil, nil, err
  }
  readDB.SetMaxOpenConns(4)

  createOrderTable := `
  CREATE TABLE IF NOT EXISTS "Order" (
    Id INTEGER PRIMARY KEY,
    RegionId INTEGER,
    Duration INTEGER,
    IsBuyOrder INTEGER,
    Issued TEXT,
    LocationId INTEGER,
    MinVolume INTEGER,
    Price REAL,
    Range TEXT,
    SystemId INTEGER,
    TypeId INTEGER,
    VolumeRemain INTEGER,
    VolumeTotal INTEGER
  );`
  _, err = writeDB.Exec(createOrderTable)
  if err != nil {
    return nil, nil, err
  }

  createLocationTable := `
  CREATE TABLE IF NOT EXISTS Location (
    Id INTEGER PRIMARY KEY,
    Name TEXT
  );`
  _, err = writeDB.Exec(createLocationTable)
  if err != nil {
    return nil, nil, err
  }

  createHistoryTable := `
  CREATE TABLE IF NOT EXISTS History (
    TypeId INTEGER,
    RegionId INTEGER,
    HistoryJson TEXT,
    PRIMARY KEY (TypeId, RegionId)
  );`
  _, err = writeDB.Exec(createHistoryTable)
  if err != nil {
    return nil, nil, err
  }

  createActiveTypesTable := `
  CREATE TABLE IF NOT EXISTS ActiveType (
    TypeId INTEGER,
    RegionId INTEGER,
    PRIMARY KEY (TypeId, RegionId)
  );`
  _, err = writeDB.Exec(createActiveTypesTable)
  if err != nil {
    return nil, nil, err
  }

  createExpirationTable := `
  CREATE TABLE IF NOT EXISTS TableExpiration (
    TableName TEXT PRIMARY KEY,
    ExpirationTime INTEGER
  );`
  _, err = writeDB.Exec(createExpirationTable)
  if err != nil {
    return nil, nil, err
  }

  pargmaConfig := `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA cache_size = 20000; -- ~80MB
  PRAGMA busy_timeout = 5000;
  `
  _, err = writeDB.Exec(pargmaConfig)
  if err != nil {
    return nil, nil, err
  }
  _, err = readDB.Exec(pargmaConfig)
  if err != nil {
    return nil, nil, err
  }

  return writeDB, readDB, nil
}
