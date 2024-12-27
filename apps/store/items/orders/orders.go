package orders

import (
	"context"
	"fmt"

	"github.com/raph5/eve-market-browser/apps/store/items/regions"
)

func Download(ctx context.Context) error {
  for _, r := range regions.Regions {
    orders, err := fetchRegionOrders(ctx, r)
    if err != nil {
      return fmt.Errorf("fetching orders: %w", err)
    }
    err = dbReplaceOrdersFromRegion(ctx, r, orders)
    if err != nil {
      return fmt.Errorf("saving orders: %w", err)
    }
  }
  return nil
}
