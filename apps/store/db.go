// NOTE: The sqlite database config is based on this article
// https://kerkour.com/sqlite-for-servers
// Very good article btw

package main

import (
	"database/sql"

	_ "github.com/mattn/go-sqlite3"
)

func initDatabase(dbPath string) (*sql.DB, *sql.DB, error) {
	writeDB, err := sql.Open("sqlite3", dbPath+"?_txlock=immediate")
	if err != nil {
		return nil, nil, err
	}
	writeDB.SetMaxOpenConns(1)

	readDB, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, nil, err
	}
	readDB.SetMaxOpenConns(4)

	createTablesAndIndexs := `
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
  );
  CREATE INDEX IF NOT EXISTS OrderTypeIndex ON "Order" (TypeId);
  CREATE INDEX IF NOT EXISTS OrderTypeRegionIndex ON "Order" (TypeId, RegionId);

  CREATE TABLE IF NOT EXISTS Location (
    Id INTEGER PRIMARY KEY,
    Name TEXT
  );
  CREATE INDEX IF NOT EXISTS LocationIndex ON Location (Id);

  CREATE TABLE IF NOT EXISTS History (
    TypeId INTEGER,
    RegionId INTEGER,
    HistoryJson TEXT,
    PRIMARY KEY (TypeId, RegionId)
  );
  CREATE INDEX IF NOT EXISTS HistoryTypeIndex ON History (TypeId);
  CREATE INDEX IF NOT EXISTS HistoryTypeRegionIndex ON History (TypeId, RegionId);

  CREATE TABLE IF NOT EXISTS ActiveMarket (
    TypeId INTEGER,
    RegionId INTEGER,
    PRIMARY KEY (TypeId, RegionId)
  );

  CREATE TABLE IF NOT EXISTS TimeRecord (
    "Key" TEXT PRIMARY KEY,
    "Time" INTEGER
  );`
	_, err = writeDB.Exec(createTablesAndIndexs)
	if err != nil {
		return nil, nil, err
	}

	pargmaConfig := `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA cache_size = 20000;   -- ~80MB
  PRAGMA busy_timeout = 10000; -- 10s
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
