// NOTE: The sqlite database config is based on this article
// https://kerkour.com/sqlite-for-servers
// Very good article btw

package database

import (
	"context"
	"database/sql"
	"strconv"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/raph5/eve-market-browser/apps/store/lib/prom"
)

type DB struct {
	write *sql.DB
	read  *sql.DB
}

type dbRow struct {
	start   time.Time
	query   string
	metrics *prom.Metrics
	row     *sql.Row
}

type dbTx struct {
	start   time.Time
	metrics *prom.Metrics
	tx      *sql.Tx
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
	metrics := ctx.Value("metrics").(*prom.Metrics)

	start := time.Now()
	rows, err := db.read.QueryContext(ctx, query, args...)
	reportRequest(metrics, err != nil, query, start)
	return rows, err
}

func (db *DB) QueryRow(ctx context.Context, query string, args ...any) *dbRow {
	if _, ok := ctx.Deadline(); !ok {
		panic("DB: your are required to wrap your database call in context with a deadline")
	}
	metrics := ctx.Value("metrics").(*prom.Metrics)

	start := time.Now()
	row := db.read.QueryRowContext(ctx, query, args...)
	return &dbRow{start: start, metrics: metrics, query: query, row: row}
}

func (dbRow *dbRow) Scan(dest ...any) error {
	err := dbRow.row.Scan(dest...)
	// NOTE: if a query is not scanned *directly* then the duration label sent to
	// prometheus might be wrong
	reportRequest(dbRow.metrics, err != nil, dbRow.query, dbRow.start)
	return err
}

func (db *DB) Exec(ctx context.Context, query string, args ...any) (sql.Result, error) {
	if _, ok := ctx.Deadline(); !ok {
		panic("DB: your are required to wrap your database call in context with a deadline")
	}
	metrics := ctx.Value("metrics").(*prom.Metrics)

	start := time.Now()
	result, err := db.write.ExecContext(ctx, query, args...)
	reportRequest(metrics, err != nil, query, start)
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
	metrics := ctx.Value("metrics").(*prom.Metrics)

	start := time.Now()
	rows, err := dbStmt.stmt.QueryContext(ctx, args...)
	reportRequest(metrics, err != nil, dbStmt.query, start)
	return rows, err
}

func (dbStmt *dbStmt) QueryRow(ctx context.Context, args ...any) *dbRow {
	if !dbStmt.read {
		panic("DB: you cant query from a write statement")
	}
	if _, ok := ctx.Deadline(); !ok {
		panic("DB: your are required to wrap your database call in context with a deadline")
	}
	metrics := ctx.Value("metrics").(*prom.Metrics)

	start := time.Now()
	row := dbStmt.stmt.QueryRowContext(ctx, args...)
	return &dbRow{start: start, metrics: metrics, query: dbStmt.query, row: row}
}

func (dbStmt *dbStmt) Exec(ctx context.Context, args ...any) (sql.Result, error) {
	if dbStmt.read {
		panic("DB: you cant exec from a read statement")
	}
	if _, ok := ctx.Deadline(); !ok {
		panic("DB: your are required to wrap your database call in context with a deadline")
	}
	metrics := ctx.Value("metrics").(*prom.Metrics)

	start := time.Now()
	result, err := dbStmt.stmt.ExecContext(ctx, args...)
	reportRequest(metrics, err != nil, dbStmt.query, start)
	return result, err
}

// WARN: Transactions are blocking: avoid long transactions
func (db *DB) Begin(ctx context.Context) (*dbTx, error) {
	metrics := ctx.Value("metrics").(*prom.Metrics)
	start := time.Now()
	tx, err := db.write.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	return &dbTx{start: start, metrics: metrics, tx: tx}, nil
}

func (dbTx *dbTx) Rollback() error {
	err := dbTx.tx.Rollback()
	reportTransactionRollback(dbTx.metrics, err != nil, dbTx.start)
	return err
}

func (dbTx *dbTx) Commit() error {
	err := dbTx.tx.Commit()
	reportTransactionCommit(dbTx.metrics, err != nil, dbTx.start)
	return err
}

func (dbTx *dbTx) Exec(ctx context.Context, query string, args ...any) (sql.Result, error) {
	if _, ok := ctx.Deadline(); !ok {
		panic("DB: your are required to wrap your database call in context with a deadline")
	}
	metrics := ctx.Value("metrics").(*prom.Metrics)

	start := time.Now()
	result, err := dbTx.tx.ExecContext(ctx, query, args...)
	reportRequest(metrics, err != nil, query, start)
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

func reportRequest(metrics *prom.Metrics, success bool, query string, start time.Time) {
	duration := strconv.FormatFloat(time.Since(start).Seconds(), 'f', 2, 64)
	if success {
		labels := prometheus.Labels{"query": query, "status": "success", "duration": duration}
		metrics.SqliteRequests.With(labels).Inc()
	} else {
		labels := prometheus.Labels{"query": query, "status": "failure", "duration": duration}
		metrics.SqliteRequests.With(labels).Inc()
	}
}

func reportTransactionRollback(metrics *prom.Metrics, success bool, start time.Time) {
	duration := strconv.FormatFloat(time.Since(start).Seconds(), 'f', 2, 64)
	if success {
		labels := prometheus.Labels{"status": "rollback_success", "duration": duration}
		metrics.SqliteRequests.With(labels).Inc()
	} else {
		labels := prometheus.Labels{"status": "rollback_failure", "duration": duration}
		metrics.SqliteRequests.With(labels).Inc()
	}
}

func reportTransactionCommit(metrics *prom.Metrics, success bool, start time.Time) {
	duration := strconv.FormatFloat(time.Since(start).Seconds(), 'f', 2, 64)
	if success {
		labels := prometheus.Labels{"status": "commit_success", "duration": duration}
		metrics.SqliteRequests.With(labels).Inc()
	} else {
		labels := prometheus.Labels{"status": "commit_failure", "duration": duration}
		metrics.SqliteRequests.With(labels).Inc()
	}
}
