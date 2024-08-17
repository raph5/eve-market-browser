package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"

	"github.com/raph5/eve-market-browser/apps/store/esi"
)

type esiOrder struct {
	Duration     int     `json:"duration"`
	IsBuyOrder   bool    `json:"is_buy_order"`
	Issued       string  `json:"issued"`
	LocationId   int     `json:"location_id"`
	MinVolume    int     `json:"min_volume"`
	OrderId      int     `json:"order_id"`
	Price        float64 `json:"price"`
	Range        string  `json:"range"`
	SystemId     int     `json:"system_id"`
	TypeId       int     `json:"type_id"`
	VolumeRemain int     `json:"volume_remain"`
	VolumeTotal  int     `json:"volume_total"`
}

type dbOrder struct {
	Duration     int
	IsBuyOrder   bool
	Issued       string
	LocationId   int
	MinVolume    int
	OrderId      int
	Price        float64
	Range        string
  RegionId     int
	SystemId     int
	TypeId       int
	VolumeRemain int
	VolumeTotal  int
}

type order struct {
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

type regionsOrders struct {
  orders   []esiOrder
  regionId int
}

var rangeMap = map[string]string{
  "station": "Station",
  "region": "Region",
  "solarsystem": "Solar System",
  "1": "1 Jumps",
  "2": "2 Jumps",
  "3": "3 Jumps",
  "4": "4 Jumps",
  "5": "5 Jumps",
  "10": "10 Jumps",
  "20": "20 Jumps",
  "30": "30 Jumps",
  "40": "40 Jumps",
}

func createOrderHandler(ctx context.Context) http.HandlerFunc {
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

    var rows *sql.Rows
    if regionId == 0 {
      orderQuery := `
      SELECT * FROM "Order"
        WHERE TypeId = ?;
      `
      rows, err = readDB.Query(orderQuery, typeId)
    } else {
      orderQuery := `
      SELECT * FROM "Order"
        WHERE TypeId = ? AND RegionId = ?;
      `
      rows, err = readDB.Query(orderQuery, typeId, regionId)
    }
    if err != nil {
      log.Printf("Internal server error: %v", err)
      http.Error(w, "Internal server error", 500)
      return
    }
    defer rows.Close()

    locationStmt, err := readDB.Prepare("SELECT Name FROM Location WHERE Id = ?")
    if err != nil {
      log.Printf("Internal server error: %v", err)
      http.Error(w, "Internal server error", 500)
      return
    }
    defer locationStmt.Close()

    orders := make([]*order, 0)
    for rows.Next() {
      var locationId int
      var order order
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

      err = locationStmt.QueryRow(locationId).Scan(&order.Location)
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

func downloadOrders(ctx context.Context) error {
  writeDB := ctx.Value("writeDB").(*sql.DB)
  localCtx, localCancel := context.WithCancelCause(ctx)
  defer localCancel(nil)
  var wg sync.WaitGroup
  regionsOrdersCh := make(chan regionsOrders, len(regions))

  // start the workers
  wg.Add(len(regions))
  for _, region := range regions {
    go func(region int) {
      defer wg.Done()
      orders, err := fetchRegionsOrders(localCtx, region)
      if err != nil {
        localCancel(err)
        return
      }
      regionsOrdersCh <- regionsOrders{
        orders: orders,
        regionId: region,
      }
    }(region)
  }

  wg.Wait()
  close(regionsOrdersCh)

  err := context.Cause(localCtx)
  if err != nil {
    return err
  }

  // commit the orders to database
  tx, err := writeDB.Begin()
  if err != nil {
    return err
  }
  defer tx.Rollback()
  _, err = tx.Exec("DELETE FROM `Order`")
  if err != nil {
    return err
  }
  stmt, err := tx.Prepare("INSERT OR REPLACE INTO `Order` VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
  if err != nil {
    return err
  }
  defer stmt.Close()

  for ro := range regionsOrdersCh {
    for _, o := range ro.orders {
      _, err := stmt.Exec(
        o.OrderId,
        ro.regionId,
        o.Duration,
        o.IsBuyOrder,
        o.Issued,
        o.LocationId,
        o.MinVolume,
        o.Price,
        rangeMap[o.Range],
        o.SystemId,
        o.TypeId,
        o.VolumeRemain,
        o.VolumeTotal,
      )
      if err != nil {
        return err
      }
    }
  }

  err = tx.Commit()
  if err != nil {
    return err
  }

  return nil
}

func fetchRegionsOrders(ctx context.Context, region int) ([]esiOrder, error) {
  orders := make([]esiOrder, 0, 1000)
  page := 1
  uri := fmt.Sprintf("/markets/%d/orders", region)
  query := map[string]string{
    "order_type": "all",
  }

  for {
    select {
    case <-ctx.Done():
      return nil, context.Canceled
    default:
      query["page"] = strconv.Itoa(page)
      pageOrders, err := esi.EsiFetch[[]esiOrder](ctx, uri, "GET", query, nil, 2, 5)
      if err != nil {
        esiError, ok := err.(*esi.EsiError)
        if ok && esiError.Code == 404 {
          return orders, nil
        }
        return nil, err
      }
      orders = append(orders, pageOrders...)
      if len(pageOrders) < 1000 {
        return orders, nil
      }
      page += 1
    }
  }
}
