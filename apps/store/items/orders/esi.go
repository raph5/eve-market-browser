package orders

import (
	"context"
	"errors"
	"fmt"

	"github.com/raph5/eve-market-browser/apps/store/lib/esi"
	"github.com/raph5/eve-market-browser/apps/store/lib/security"
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

func fetchPageOrders(ctx context.Context, regionId int, page int) ([]dbOrder, int, error) {
  uri := fmt.Sprintf("/markets/%d/orders?order_type=all&page=%d", regionId, page)
  response, err := esi.EsiFetch[[]esiOrder](ctx, "GET", uri, nil, 2, 5)
  if err != nil {
    return nil, 0, err
  }
  esiOrders := *response.Data
  pages := response.Pages

  dbOrders := make([]dbOrder, len(esiOrders))
  for i := 0; i < len(esiOrders); i++ {
    err = esiToDbOrder(&esiOrders[i], &dbOrders[i], regionId)
    if err != nil {
      return  nil, 0, err
    }
  }

  return dbOrders, pages, nil
}

func esiToDbOrder(esiOrder *esiOrder, dbOrder *dbOrder, regionId int) error {
  if dbOrder.Duration < 0 || dbOrder.Duration > 90 {
    return fmt.Errorf("invalid duration %d: %w", dbOrder.Duration, ErrInvalidEsiData)
  }
  if len(dbOrder.Issued) > 32 {
    return fmt.Errorf("invalid issued time %s: %w", dbOrder.Issued, ErrInvalidEsiData)
  }
  if security.ContainsXssPayload(dbOrder.Issued) {
    return fmt.Errorf("invalid issued time %s: %w", dbOrder.Issued, ErrInvalidEsiData)
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
