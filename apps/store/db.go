package main

import (
	"context"
	"database/sql"
	"errors"
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

	dbRead, err := sql.Open("sqlite3", dbPath+"?_busy_timeout=5000&_journal_mode=WAL&_synchronous=NORMAL")
	if err != nil {
		return nil, nil, err
	}
	dbRead.SetMaxOpenConns(4)

	createTablesAndIndexs := `
  CREATE TABLE IF NOT EXISTS "Order" (
    Id INTEGER,  -- Not guaranteed to be unique
    RegionId INTEGER,
    Duration INTEGER,
    IsBuyOrder INTEGER,
    Issued INTEGER,
    LocationId INTEGER,
    MinVolume INTEGER,
    Price REAL,
    Range INTEGER,
    SystemId INTEGER,
    TypeId INTEGER,
    VolumeRemain INTEGER,
    VolumeTotal INTEGER
  );
  CREATE INDEX IF NOT EXISTS OrderTypeIndex ON "Order" (TypeId);
  CREATE INDEX IF NOT EXISTS OrderTypeRegionIndex ON "Order" (TypeId, RegionId);

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
  );

  CREATE TABLE IF NOT EXISTS TimeRecord (
    Key TEXT PRIMARY KEY,
    Time INTEGER  -- Epoch Seconds
  );`
	_, err = dbWrite.Exec(createTablesAndIndexs)
	if err != nil {
		return nil, nil, err
	}

	return dbWrite, dbRead, nil
}

func dbGetActiveMarkets(ctx context.Context) ([]emd.HistoryMarket, error) {
	dbRead := ctx.Value("dbRead").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	activeMarkets := make([]emd.HistoryMarket, 0, 100_000)

	rows, err := dbRead.QueryContext(timeoutCtx, "SELECT TypeId, RegionId FROM ActiveMarket")
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

func dbGetKnownLocationMap(ctx context.Context) (map[uint64]struct{}, error) {
	dbRead := ctx.Value("dbRead").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	locationMap := make(map[uint64]struct{})

	rows, err := dbRead.QueryContext(timeoutCtx, "SELECT Id FROM Location")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id uint64
		err = rows.Scan(&id)
		if err != nil {
			return nil, err
		}
		locationMap[id] = struct{}{}
	}

	err = rows.Err()
	if err != nil {
		return nil, err
	}
	return locationMap, nil
}

func dbGetLocationMapForIds(ctx context.Context, locationId []uint64) (map[uint64]emd.Location, error) {
	dbRead := ctx.Value("dbRead").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	locationMap := make(map[uint64]emd.Location)

	stmt, err := dbRead.PrepareContext(timeoutCtx, "SELECT * FROM Location WHERE Id = ?")
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	for _, id := range locationId {
		var l emd.Location
		err = stmt.QueryRowContext(timeoutCtx, id).Scan(&l.Id, &l.TypeId, &l.OwnerId, &l.SystemId, &l.RegionId, &l.Name, &l.Security)
		if errors.Is(err, sql.ErrNoRows) {
			continue
		}
		if err != nil {
			return nil, err
		}
		locationMap[id] = l
	}
	return locationMap, nil
}

func dbGetDayMetricsForTypeAndRegion(ctx context.Context, typeId uint64, regionId uint64) ([]dbDayMetric, error) {
	dbRead := ctx.Value("dbRead").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	dayMetric := make([]dbDayMetric, 0, 512)

	query := `SELECT Date, OrderCount, Volume, Average, Highest, Lowest FROM DayMetric
WHERE TypeId = ? AND RegionId = ?
ORDER BY Date`
	rows, err := dbRead.QueryContext(timeoutCtx, query, typeId, regionId)
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

func dbGetOrdersForType(ctx context.Context, typeId uint64) ([]emd.Order, error) {
	dbRead := ctx.Value("dbRead").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	orders := make([]emd.Order, 0, 512)

	rows, err := dbRead.QueryContext(timeoutCtx, `SELECT * FROM "Order" WHERE TypeId = ?`, typeId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var o emd.Order
		err = rows.Scan(
			&o.OrderId,
			&o.RegionId,
			&o.Duration,
			&o.IsBuyOrder,
			&o.Issued,
			&o.LocationId,
			&o.MinVolume,
			&o.Price,
			&o.Range,
			&o.SystemId,
			&o.TypeId,
			&o.VolumeRemain,
			&o.VolumeTotal,
		)
		if err != nil {
			return nil, err
		}
		orders = append(orders, o)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}
	return orders, nil
}

func dbGetOrdersForTypeAndRegion(ctx context.Context, typeId uint64, regionId uint64) ([]emd.Order, error) {
	dbRead := ctx.Value("dbRead").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	orders := make([]emd.Order, 0, 512)

	rows, err := dbRead.QueryContext(timeoutCtx, `SELECT * FROM "Order" WHERE TypeId = ? AND RegionId = ?`, typeId, regionId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var o emd.Order
		err = rows.Scan(
			&o.OrderId,
			&o.RegionId,
			&o.Duration,
			&o.IsBuyOrder,
			&o.Issued,
			&o.LocationId,
			&o.MinVolume,
			&o.Price,
			&o.Range,
			&o.SystemId,
			&o.TypeId,
			&o.VolumeRemain,
			&o.VolumeTotal,
		)
		if err != nil {
			return nil, err
		}
		orders = append(orders, o)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}
	return orders, nil
}

func dbIsDayMetricTableEmpty(ctx context.Context) (bool, error) {
	dbRead := ctx.Value("dbRead").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	var tableLength uint64
	err := dbRead.QueryRowContext(timeoutCtx, "SELECT count(*) FROM DayMetric").Scan(&tableLength)
	if err != nil {
		return false, err
	}
	return tableLength == 0, nil
}

func dbAddDayMetrics(ctx context.Context, date time.Time, dayMetrics []emd.HistoryDay) error {
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
		_, err := stmt.Exec(d.TypeId, d.RegionId, dateUnix, d.OrderCount, d.Volume, d.Average, d.Highest, d.Lowest)
		if err != nil {
			return err
		}
	}
	return nil
}

func dbAddLocations(ctx context.Context, newLocations []emd.Location) error {
	dbWrite := ctx.Value("dbWrite").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	stmt, err := dbWrite.PrepareContext(timeoutCtx, "INSERT INTO Location VALUES (?,?,?,?,?,?,?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, l := range newLocations {
		_, err := stmt.Exec(l.Id, l.TypeId, l.OwnerId, l.SystemId, l.RegionId, l.Name, l.Security)
		if err != nil {
			return err
		}
	}
	return nil
}

func dbSetActiveMarkets(ctx context.Context, markets []emd.HistoryMarket, now time.Time) error {
	dbWrite := ctx.Value("dbWrite").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	stmt, err := dbWrite.PrepareContext(timeoutCtx, "INSERT OR REPLACE INTO ActiveMarket VALUES (?,?,?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	nowUnix := now.Unix()
	for _, m := range markets {
		_, err := stmt.Exec(m.TypeId, m.RegionId, nowUnix)
		if err != nil {
			return err
		}
	}
	return nil
}

func dbReplaceOrders(ctx context.Context, orders []emd.Order) error {
	dbWrite := ctx.Value("dbWrite").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	tx, err := dbWrite.BeginTx(timeoutCtx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(timeoutCtx, "DELETE FROM \"Order\"")
	if err != nil {
		return err
	}

	// Sometime there are two orders that have the same orderId. This rare so
	// we don't do anything special in that case.
	stmt, err := tx.PrepareContext(timeoutCtx, "INSERT INTO \"Order\" VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, o := range orders {
		_, err = stmt.ExecContext(timeoutCtx, o.OrderId, o.RegionId, o.Duration,
			o.IsBuyOrder, o.Issued, o.LocationId, o.MinVolume, o.Price, o.Range,
			o.SystemId, o.TypeId, o.VolumeRemain, o.VolumeTotal)
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

func dbGetTimeRecord(ctx context.Context, key string) (time.Time, error) {
	dbRead := ctx.Value("dbRead").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 1*time.Minute)
	defer cancel()

	var val uint64
	err := dbRead.QueryRowContext(timeoutCtx, "SELECT Time FROM TimeRecord WHERE Key = ?", key).Scan(&val)
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(int64(val), 0), nil
}

func dbSetTimeRecord(ctx context.Context, key string, val time.Time) error {
	dbWrite := ctx.Value("dbWrite").(*sql.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 1*time.Minute)
	defer cancel()

	_, err := dbWrite.ExecContext(timeoutCtx, "INSERT OR REPLACE INTO TimeRecord VALUES (?,?)", key, val.Unix())
	if err != nil {
		return err
	}
	return nil
}
