package main

import (
	"context"
	"database/sql"
	"time"

	_ "github.com/mattn/go-sqlite3"
	emd "github.com/raph5/eve-market-dump"
)

type dbDayMetric struct {
	Date       uint64
	Average    float64
	Highest    float64
	Lowest     float64
	OrderCount uint64
	Volume     uint64
}

type dbTickMetric struct {
	Time       uint64
	LocationId uint64
	Average    float64
	Volume     uint64
}

func dbInit(dbPath string) (*sql.DB, *sql.DB, error) {
	dbWrite, err := sql.Open("sqlite3", dbPath+"?_busy_timeout=5000&_journal_mode=WAL&_synchronous=NORMAL&_txlock=immediate")
	if err != nil {
		return nil, nil, err
	}
	dbWrite.SetMaxOpenConns(1)

	dbWrite, err := sql.Open("sqlite3", dbPath+"?_busy_timeout=5000&_journal_mode=WAL&_synchronous=NORMAL")
	if err != nil {
		return nil, nil, err
	}
	dbWrite.SetMaxOpenConns(4)

	createTablesAndIndexs := `
  CREATE TABLE IF NOT EXISTS DayMetric (
    TypeId INTEGER,
    RegionId INTEGER,
    Date INTEGER,  -- Epoch Seconds
    OrderCount INTEGER,
    Volume INTEGER,
    Average REAL,
    Highest REAL,
    Lowest REAL,
    PRIMARY KEY (Date, TypeId, RegionId)
  );
  CREATE INDEX IF NOT EXISTS DayMetricTypeRegionIndex ON DayMetric (TypeId, RegionId);

  CREATE TABLE IF NOT EXISTS TickMetric (
    TypeId INTEGER,
    Time INTEGER,  -- Epoch Seconds
    LocationId INTEGER,
    Average REAL,
    Volume INTEGER,
    PRIMARY KEY (Time, TypeId, LocationId)
  );
  CREATE INDEX IF NOT EXISTS TickMetricTypeRegionIndex ON TickMetric (TypeId, LocationId);

  CREATE TABLE IF NOT EXISTS Location (
    Id INTEGER PRIMARY KEY,
    TypeId INTEGER,
    OwnerId INTEGER,
    SystemId INTEGER,
    RegionId INTEGER,
    Name TEXT,
    Security REAL
  );
  CREATE INDEX IF NOT EXISTS LocationIndex ON Location (Id);
  CREATE INDEX IF NOT EXISTS LocationRegionIndex ON Location (RegionId);

  CREATE TABLE IF NOT EXISTS ActiveMarket (
    TypeId INTEGER,
    RegionId INTEGER,
    LastActivity INTEGER,  -- Epoch Seconds
    PRIMARY KEY (TypeId, RegionId)
  );`
	_, err = dbWrite.Exec(createTablesAndIndexs)
	if err != nil {
		return nil, nil, err
	}

	return dbWrite, dbWrite, nil
}

func dbGetActiveMarketMap(ctx context.Context) (map[emd.HistoryMarket]struct{}, error) {
	dbWrite := ctx.Value("dbWrite").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	activeMarkets := make(map[emd.HistoryMarket]struct{})

	rows, err := dbWrite.QueryContext(timeoutCtx, "SELECT TypeId, RegionId FROM ActiveMarket")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var market emd.HistoryMarket
		err := rows.Scan(&market.TypeId, &market.RegionId)
		if err != nil {
			return nil, err
		}
		activeMarkets[market] = struct{}{}
	}

	err = rows.Err()
	if err != nil {
		return nil, err
	}
	return activeMarkets, nil
}

func dbGetActiveMarkets(ctx context.Context) ([]emd.HistoryMarket, error) {
	dbWrite := ctx.Value("dbWrite").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	activeMarkets := make([]emd.HistoryMarket, 0, 100_000)

	rows, err := dbWrite.QueryContext(timeoutCtx, "SELECT TypeId, RegionId FROM ActiveMarket")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var market emd.HistoryMarket
		err := rows.Scan(&market.TypeId, &market.RegionId)
		if err != nil {
			return nil, err
		}
		activeMarkets = append(activeMarkets, market)
	}

	err = rows.Err()
	if err != nil {
		return nil, err
	}
	return activeMarkets, nil
}

func dbGetLocationMap(ctx context.Context) (map[uint64]emd.Location, error) {
	dbWrite := ctx.Value("dbWrite").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	locationMap := make(map[uint64]emd.Location)

	rows, err := dbWrite.QueryContext(timeoutCtx, "SELECT Id, TypeId, OwnerId, SystemId, Security, Name FROM ActiveMarket")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var loc emd.Location
		err := rows.Scan(&loc.Id, &loc.TypeId, &loc.OwnerId, &loc.SystemId, &loc.Security, &loc.Name)
		if err != nil {
			return nil, err
		}
		locationMap[loc.Id] = loc
	}

	err = rows.Err()
	if err != nil {
		return nil, err
	}
	return locationMap, nil
}

// NOTE: dbDayMetric type is subject to future changes or replacements
func dbGetDayMetricForTypeAndRegion(ctx context.Context, typeId uint64, regionId uint64) ([]dbDayMetric, error) {
	dbWrite := ctx.Value("dbWrite").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	dayMetric := make([]dbDayMetric, 512)

	query := `SELECT Date, OrderCount, Volume, Average, Highest, Lowest FROM ActiveMarket
WHERE TypeId = ? AND RegionId = ?
ORDER BY Date`
	rows, err := dbWrite.QueryContext(timeoutCtx, query, typeId, regionId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var day dbDayMetric
		err := rows.Scan(&day.Date, &day.OrderCount, &day.Volume, &day.Average, &day.Highest, &day.Lowest)
		if err != nil {
			return nil, err
		}
		dayMetric = append(dayMetric, day)
	}

	err = rows.Err()
	if err != nil {
		return nil, err
	}
	return dayMetric, nil
}

func dbIsDayMetricTableEmpty(ctx context.Context) (bool, error) {
	dbWrite := ctx.Value("dbWrite").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	var tableLength uint64
	err := dbWrite.QueryRowContext(timeoutCtx, "SELECT count(*) FROM DayMetric").Scan(&tableLength)
	if err != nil {
		return false, err
	}
	return tableLength == 0, nil
}

func dbPushDayMetrics(ctx context.Context, date time.Time, dayMetrics []emd.HistoryDay) error {
	dbWrite := ctx.Value("dbWrite").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	dateUnix := date.Unix()
	stmt, err := dbWrite.PrepareContext(timeoutCtx, "INSERT INTO DayMetric VALUES (?,?,?,?,?,?,?,?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, d := range dayMetrics {
		_, err := stmt.Exec(stmt, d.TypeId, d.RegionId, dateUnix, d.OrderCount, d.Volume, d.Average, d.Highest, d.Lowest)
		if err != nil {
			return err
		}
	}
	return nil
}
