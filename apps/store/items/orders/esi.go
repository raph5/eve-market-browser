package orders

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/lib/esi"
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

var ErrInvalidEsiData = errors.New("Invalid esi data")

func fetchRegionOrders(ctx context.Context, regionId int) ([]dbOrder, error) {
  timeoutCtx, timeoutCancel := context.WithTimeout(ctx, 15 * time.Minute)
  errorCtx, errorCancel := context.WithCancelCause(timeoutCtx)
  defer timeoutCancel()

  var wg sync.WaitGroup
  var noMorePages atomic.Bool
  var page atomic.Int32
  ordersCh := make(chan []dbOrder, 2 * esi.MaxConcurrentRequests)
  page.Store(1)

  worker := func() {
    defer wg.Done()
    for i := 0; i < 2000; i++ {
      if noMorePages.Load() {
        return
      }
      p := page.Add(1)

      pageOrders, nmp, err := fetchPageOrders(errorCtx, regionId, int(p))
      if err != nil {
        errorCancel(err)
        return
      }
      if nmp {
        noMorePages.Store(true)
      }
      ordersCh <- pageOrders
    }
    panic("orders fetcher worker: too many iterations");
  }

  for i := 0; i < esi.MaxConcurrentRequests; i++ {
    go worker()
  }

  go func() {
    wg.Wait()
    close(ordersCh)
  }()

  orders := make([]dbOrder, 0)
  for o := range ordersCh {
    orders = append(orders, o...)
  }

  if err := context.Cause(errorCtx); err != nil {
    return nil, err
  }

  errorCancel(nil)
  return orders, nil
}

func fetchPageOrders(ctx context.Context, regionId int, page int) ([]dbOrder, bool, error) {
  uri := fmt.Sprintf("/markets/%d/orders?order_type=all&page=%d", regionId, page)
  esiOrders, err := esi.EsiFetch[[]esiOrder](ctx, "GET", uri, nil, 2, 5)

  if err != nil {
    esiError, ok := err.(*esi.EsiError)
    if ok && esiError.Code == 404 {
      return nil, true, nil
    }
    return nil, false, err
  }

  dbOrders := make([]dbOrder, len(*esiOrders))
  for i := 0; i < len(*esiOrders); i++ {
    err = esiToDbOrder(&(*esiOrders)[i], &dbOrders[i], regionId)
    if err != nil {
      return  nil, false, err
    }
  }

  noMorePages := len(dbOrders) < 1000
  return dbOrders, noMorePages, nil
}

func esiToDbOrder(esiOrder *esiOrder, dbOrder *dbOrder, regionId int) error {
  if dbOrder.Duration < 0 || dbOrder.Duration > 90 {
    return fmt.Errorf("invalid duration %d: %w", dbOrder.Duration, ErrInvalidEsiData)
  }
  if len(dbOrder.Issued) > 32 {
    return fmt.Errorf("invalid issued time %s: %w", dbOrder.Issued, ErrInvalidEsiData)
  }
  for i := 0; i < len(dbOrder.Issued); i++ {
    // check for xss injections
    if dbOrder.Issued[i] == '<' {
      return fmt.Errorf("invalid issued time %s: %w", dbOrder.Issued, ErrInvalidEsiData)
    }
  }
  orderRange, ok := esiToDbRangeMap[esiOrder.Range]
  if !ok {
    return fmt.Errorf("invalid range %s: %w", dbOrder.Range, ErrInvalidEsiData)
  }
  dbOrder.Duration = esiOrder.Duration
  dbOrder.IsBuyOrder = esiOrder.IsBuyOrder
  dbOrder.Issued = esiOrder.Issued
  dbOrder.LocationId = esiOrder.LocationId
  dbOrder.MinVolume = esiOrder.MinVolume
  dbOrder.OrderId = esiOrder.OrderId
  dbOrder.Price = esiOrder.Price
  dbOrder.Range = orderRange
  dbOrder.RegionId = regionId
  dbOrder.SystemId = esiOrder.SystemId
  dbOrder.TypeId = esiOrder.TypeId
  dbOrder.VolumeRemain = esiOrder.VolumeRemain
  dbOrder.VolumeTotal = esiOrder.VolumeTotal
  return nil
}
