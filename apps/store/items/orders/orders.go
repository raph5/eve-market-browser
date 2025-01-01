package orders

import (
	"context"
	"fmt"
	"sync"

	"github.com/raph5/eve-market-browser/apps/store/items/regions"
)

// NOTE: I tryed two approaches for downloading the orders:
//  - fetching the regions one by one and parallelizing the process of fetching
//    the orders inside a region
//  - fetching all regions in parallel and fetch the orders inside a region
//    sequentially
// Though the first approach was more simple to write it turned out to be
// significantly slower (~7min against ~3min for the second approach).
// Here I implemented the second approach
func Download(ctx context.Context) error {
  errorCtx, errorCancel := context.WithCancelCause(ctx)
  defer errorCancel(nil)
  var wg sync.WaitGroup

  wg.Add(len(regions.Regions))
  for _, region := range regions.Regions {
    go func() {
      defer wg.Done()
      err := downloadRegion(ctx, region)
      if err != nil {
        errorCancel(err)
        return
      }
    }()
  }

  wg.Wait()

  if err := context.Cause(errorCtx); err != nil {
    return err
  }

  return nil
}

func downloadRegion(ctx context.Context, regionId int) error {
  var pageOrders []dbOrder
  var err error
  var pages int
  orders := make([]dbOrder, 0, 1000)

  for p := 1; p < pages || p == 1; p++ {
    pageOrders, pages, err = fetchPageOrders(ctx, regionId, p)
    if err != nil {
      return fmt.Errorf("fetching page %d from region %d: %w", p, regionId, err)
    }
    orders = append(orders, pageOrders...)
  }

  err = dbReplaceOrdersFromRegion(ctx, regionId, orders)
  if err != nil {
    return fmt.Errorf("replacing orders from regoin: %w", err)
  }

  return nil
}
