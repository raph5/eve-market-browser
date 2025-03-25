package orders

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/lib/database"
)

// orders type that the store will return
type apiOrder struct {
	Duration     int     `json:"duration"`
	IsBuyOrder   bool    `json:"isBuyOrder"`
	Issued       string  `json:"issued"`
	Location     string  `json:"location"`
	MinVolume    int     `json:"minVolume"`
	OrderId      int     `json:"orderId"`
	Price        float64 `json:"price"`
	Range        string  `json:"range"`
	RegionId     int     `json:"regionId"`
	SystemId     int     `json:"systemId"`
	TypeId       int     `json:"typeId"`
	VolumeRemain int     `json:"volumeRemain"`
	VolumeTotal  int     `json:"volumeTotal"`
}

// NOTE: even though I could split the fonction in two api and db function,
// I don't do it for the sake of performance.
func CreateHandler(ctx context.Context) http.HandlerFunc {
	db := ctx.Value("db").(*database.DB)

	return func(w http.ResponseWriter, r *http.Request) {
		// TODO: try reducing the timeout to 3s
		timeoutCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()

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

		var rows *sql.Rows
		if regionId == 0 {
			orderQuery := `
      SELECT * FROM "Order"
        WHERE TypeId = ?;
      `
			rows, err = db.Query(timeoutCtx, orderQuery, typeId)
		} else {
			orderQuery := `
      SELECT * FROM "Order"
        WHERE TypeId = ? AND RegionId = ?;
      `
			rows, err = db.Query(timeoutCtx, orderQuery, typeId, regionId)
		}
		if err != nil {
			log.Printf("Internal server error: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}
		defer rows.Close()

		locationStmt, err := db.PrepareRead(timeoutCtx, "SELECT Name FROM Location WHERE Id = ?")
		if err != nil {
			log.Printf("Internal server error: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}
		defer locationStmt.Close()

		orders := make([]*apiOrder, 0)
		for rows.Next() {
			var locationId int
			var order apiOrder
			err = rows.Scan(
				&order.OrderId,
				&order.RegionId,
				&order.Duration,
				&order.IsBuyOrder,
				&order.Issued,
				&locationId,
				&order.MinVolume,
				&order.Price,
				&order.Range,
				&order.SystemId,
				&order.TypeId,
				&order.VolumeRemain,
				&order.VolumeTotal,
			)
			if err != nil {
				log.Printf("Internal server error: %v", err)
				http.Error(w, "Internal server error", 500)
				return
			}

			err = locationStmt.QueryRow(timeoutCtx, locationId).Scan(&order.Location)
			if err != nil && !errors.Is(err, sql.ErrNoRows) {
				log.Printf("Internal server error: %v", err)
				http.Error(w, "Internal server error", 500)
				return
			}
			if order.Location == "" {
				order.Location = "Unknown Player Structure"
			}

			orders = append(orders, &order)
		}

		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(orders)
		if err != nil {
			log.Printf("Internal server error: %v", err)
			http.Error(w, "Internal server error", 500)
			return
		}
	}
}
