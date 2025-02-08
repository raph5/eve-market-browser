package histories

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strconv"
)

// NOTE: even though I could split the fonction in two api and db function,
// I don't do it for the sake of performance.
func CreateHandler(ctx context.Context) http.HandlerFunc {
	readDB := ctx.Value("readDB").(*sql.DB)

	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		typeId, err := strconv.Atoi(query.Get("type"))
		if err != nil {
			http.Error(w, `Bad request: param "type" is invalid integer`, 400)
			return
		}
		regionId, err := strconv.Atoi(query.Get("region"))
		if err != nil {
			http.Error(w, `Bad request: param "region" is invalid integer`, 400)
			return
		}

		var historyJson []byte
		historyQuery := `
    SELECT HistoryJson FROM History
      WHERE TypeId = ? AND RegionId = ?;
    `
		err = readDB.QueryRow(historyQuery, typeId, regionId).Scan(&historyJson)
		if err != nil && errors.Is(err, sql.ErrNoRows) {
			log.Printf("History for type %d in region %d is not available", typeId, regionId)
			http.Error(w, "History not available", 404)
			return
		} else if err != nil {
			log.Printf("Internal server error: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write(historyJson)
	}
}
