package orders

import (
	"context"
	"fmt"

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

// func Download(ctx context.Context) error {
//   errorCtx, errorCancel := context.WithCancelCause(ctx)
//   var wg sync.WaitGroup
//   ordersCh := make(chan []dbOrder, len(regions.Regions))

//   wg.Add(len(regions.Regions))
//   for _, region := range regions.Regions {
//     go func() {
//       defer wg.Done()
//       orders, err := fetchRegionOrders(errorCtx, region)
//       if err != nil {
//         errorCancel(err)
//         return
//       }
//       ordersCh <- orders
//     }()
//   }

//   wg.Wait()
//   close(ordersCh)
//   if err := context.Cause(errorCtx); err != nil {
//     return err
//   }
//   errorCancel(nil)

//   err := dbReplaceAllOrders(ctx, ordersCh)
//   if err != nil {
//     return err
//   }

//   return nil
// }

func Download(ctx context.Context) error {
  for _, regionId := range regions.Regions {
    orders, err := fetchRegionOrders(ctx, regionId)
    if err != nil {
      // TODO: wrapping
      return err
    }

    err = dbReplaceOrdersFromRegion(ctx, regionId, orders)
    if err != nil {
      // TODO: wrapping
      return err
    }
  }

  return nil
}

func fetchRegionOrders(ctx context.Context, regionId int) ([]dbOrder, error) {
  var pageOrders []dbOrder
  var err error
  var pages int
  orders := make([]dbOrder, 0, 1000)

  for p := 1; p <= pages || p == 1; p++ {
    pageOrders, pages, err = fetchPageOrders(ctx, regionId, p)
    if err != nil {
      return nil, fmt.Errorf("fetching page %d from region %d: %w", p, regionId, err)
    }
    orders = append(orders, pageOrders...)
  }

  return orders, nil
}
