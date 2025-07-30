// NOTE: The sqlite database config is based on this article
// https://kerkour.com/sqlite-for-servers
// Very good article btw

package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/VictoriaMetrics/metrics"
	_ "github.com/mattn/go-sqlite3"
	"github.com/raph5/eve-market-browser/apps/store/lib/victoria"
)

type DB struct {
	write *sql.DB
	read  *sql.DB
}

type dbRow struct {
	duration time.Duration
	query    string
	row      *sql.Row
}

type dbTx struct {
	start time.Time
	tx    *sql.Tx
}

type dbStmt struct {
	read  bool
	query string
	stmt  *sql.Stmt
}

func Init(dbPath string) (*DB, error) {
	dbWrite, err := sql.Open("sqlite3", dbPath+"?_txlock=immediate")
	if err != nil {
		return nil, err
	}
	dbWrite.SetMaxOpenConns(1)

	dbRead, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}
	dbRead.SetMaxOpenConns(4)

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
    SystemId INTEGER,  -- For now I dont need to mark it as a foriegn key
    Name TEXT,
    Security REAL
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

  CREATE TABLE IF NOT EXISTS DayTypeMetric (
    TypeId INTEGER,
    RegionId INTEGER,
    Date TEXT,  -- YYYY-MM-DD (https://sqlite.org/lang_datefunc.html#time_values)
    BuyPrice REAL,
    SellPrice REAL,
    Volume INTERGER
    -- PRIMARY KEY (Date, TypeId) removed by fear of a slow down
  );
  CREATE INDEX IF NOT EXISTS DayTypeMetricTypeIndex ON DayTypeMetric (TypeId, RegionId, Date DESC);

  CREATE TABLE IF NOT EXISTS TimeRecord (
    "Key" TEXT PRIMARY KEY,
    Time INTEGER  -- Epoch Seconds
  );`
	_, err = dbWrite.Exec(createTablesAndIndexs)
	if err != nil {
		return nil, err
	}

	pargmaConfig := `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA cache_size = 20000;   -- ~80MB
  PRAGMA busy_timeout = 10000; -- 10s
  `
	_, err = dbWrite.Exec(pargmaConfig)
	if err != nil {
		return nil, err
	}
	_, err = dbRead.Exec(pargmaConfig)
	if err != nil {
		return nil, err
	}

	return &DB{write: dbWrite, read: dbRead}, nil
}

func (db *DB) Close() {
	db.read.Close()
	db.write.Close()
}

func (db *DB) Query(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	if _, ok := ctx.Deadline(); !ok {
		panic("DB: your are required to wrap your database call in context with a deadline")
	}

	start := time.Now()
	rows, err := db.read.QueryContext(ctx, query, args...)
	reportRequest(err, query, time.Since(start))
	return rows, err
}

func (db *DB) QueryRow(ctx context.Context, query string, args ...any) *dbRow {
	if _, ok := ctx.Deadline(); !ok {
		panic("DB: your are required to wrap your database call in context with a deadline")
	}

	start := time.Now()
	row := db.read.QueryRowContext(ctx, query, args...)
	return &dbRow{row: row, query: query, duration: time.Since(start)}
}

func (dbRow *dbRow) Scan(dest ...any) error {
	err := dbRow.row.Scan(dest...)
	reportRequest(err, dbRow.query, dbRow.duration)
	return err
}

func (db *DB) Exec(ctx context.Context, query string, args ...any) (sql.Result, error) {
	if _, ok := ctx.Deadline(); !ok {
		panic("DB: your are required to wrap your database call in context with a deadline")
	}

	start := time.Now()
	result, err := db.write.ExecContext(ctx, query, args...)
	reportRequest(err, query, time.Since(start))
	return result, err
}

func (db *DB) PrepareRead(ctx context.Context, query string) (*dbStmt, error) {
	stmt, err := db.read.PrepareContext(ctx, query)
	if err != nil {
		return nil, err
	}
	return &dbStmt{stmt: stmt, query: query, read: true}, nil
}

func (db *DB) PrepareWrite(ctx context.Context, query string) (*dbStmt, error) {
	stmt, err := db.write.PrepareContext(ctx, query)
	if err != nil {
		return nil, err
	}
	return &dbStmt{stmt: stmt, query: query, read: false}, nil
}

func (dbStmt *dbStmt) Close() error {
	return dbStmt.stmt.Close()
}

func (dbStmt *dbStmt) Query(ctx context.Context, args ...any) (*sql.Rows, error) {
	if !dbStmt.read {
		panic("DB: you cant query from a write statement")
	}
	if _, ok := ctx.Deadline(); !ok {
		panic("DB: your are required to wrap your database call in context with a deadline")
	}

	start := time.Now()
	rows, err := dbStmt.stmt.QueryContext(ctx, args...)
	reportRequest(err, dbStmt.query, time.Since(start))
	return rows, err
}

func (dbStmt *dbStmt) QueryRow(ctx context.Context, args ...any) *dbRow {
	if !dbStmt.read {
		panic("DB: you cant query from a write statement")
	}
	if _, ok := ctx.Deadline(); !ok {
		panic("DB: your are required to wrap your database call in context with a deadline")
	}

	start := time.Now()
	row := dbStmt.stmt.QueryRowContext(ctx, args...)
	return &dbRow{row: row, duration: time.Since(start), query: dbStmt.query}
}

func (dbStmt *dbStmt) Exec(ctx context.Context, args ...any) (sql.Result, error) {
	if dbStmt.read {
		panic("DB: you cant exec from a read statement")
	}
	if _, ok := ctx.Deadline(); !ok {
		panic("DB: your are required to wrap your database call in context with a deadline")
	}

	start := time.Now()
	result, err := dbStmt.stmt.ExecContext(ctx, args...)
	reportRequest(err, dbStmt.query, time.Since(start))
	return result, err
}

// WARN: Transactions are blocking: avoid long transactions
func (db *DB) Begin(ctx context.Context) (*dbTx, error) {
	start := time.Now()
	tx, err := db.write.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	return &dbTx{tx: tx, start: start}, nil
}

func (dbTx *dbTx) Rollback() error {
	err := dbTx.tx.Rollback()
	reportTransactionRollback(err, time.Since(dbTx.start))
	return err
}

func (dbTx *dbTx) Commit() error {
	err := dbTx.tx.Commit()
	reportTransactionCommit(err, time.Since(dbTx.start))
	return err
}

func (dbTx *dbTx) Exec(ctx context.Context, query string, args ...any) (sql.Result, error) {
	if _, ok := ctx.Deadline(); !ok {
		panic("DB: your are required to wrap your database call in context with a deadline")
	}

	start := time.Now()
	result, err := dbTx.tx.ExecContext(ctx, query, args...)
	reportRequest(err, query, time.Since(start))
	return result, err
}

func (dbTx *dbTx) PrepareRead(ctx context.Context, query string) (*dbStmt, error) {
	stmt, err := dbTx.tx.PrepareContext(ctx, query)
	if err != nil {
		return nil, err
	}
	return &dbStmt{stmt: stmt, query: query, read: true}, nil
}

func (dbTx *dbTx) PrepareWrite(ctx context.Context, query string) (*dbStmt, error) {
	stmt, err := dbTx.tx.PrepareContext(ctx, query)
	if err != nil {
		return nil, err
	}
	return &dbStmt{stmt: stmt, query: query, read: false}, nil
}

func reportRequest(err error, query string, duration time.Duration) {
	query = victoria.Escape(query)
	requestDuration := fmt.Sprintf(`store_sqlite_request_duration{query="%s"}`, query)
	var requestCount string
	if err == nil || errors.Is(err, sql.ErrNoRows) {
		requestCount = fmt.Sprintf(`store_sqlite_request_total{query="%s",status="success"}`, query)
	} else {
		requestCount = fmt.Sprintf(`store_sqlite_request_total{query="%s",status="failure"}`, query)
		log.Printf("Database: %v", err)
	}
	// NOTE: GetOrCreateCounter perform a global mutex lock. If this is a
	// bottleneck I can split different metrics into diffrent metrics sets to
	// only lock the mutex of the set.
	metrics.GetOrCreateCounter(requestCount).Inc()
	metrics.GetOrCreateFloatCounter(requestDuration).Add(duration.Seconds())
}

func reportTransactionRollback(err error, duration time.Duration) {
	transactionDuration := `store_sqlite_transaction_duration`
	var transactionCount string
	if err == nil || errors.Is(err, sql.ErrTxDone) {
		transactionCount = `store_sqlite_transaction_total{status="rollback_success"}`
	} else {
		transactionCount = `store_sqlite_transaction_total{status="rollback_failure"}`
		log.Printf("Database: %v", err)
	}
	metrics.GetOrCreateCounter(transactionCount).Inc()
	metrics.GetOrCreateFloatCounter(transactionDuration).Add(duration.Seconds())
}

func reportTransactionCommit(err error, duration time.Duration) {
	transactionDuration := `store_sqlite_transaction_duration`
	var transactionCount string
	if err == nil || errors.Is(err, sql.ErrTxDone) {
		transactionCount = `store_sqlite_transaction_total{status="commit_success"}`
	} else {
		transactionCount = `store_sqlite_transaction_total{status="commit_failure"}`
		log.Printf("Database: %v", err)
	}
	metrics.GetOrCreateCounter(transactionCount).Inc()
	metrics.GetOrCreateFloatCounter(transactionDuration).Add(duration.Seconds())
}
