package orders

import (
	"context"
	"fmt"

	"github.com/raph5/eve-market-browser/apps/store/items/regions"
)

// NOTE: I tryed two approaches for downloading the orders:
//   - fetching the regions one by one and parallelizing the process of fetching
//     the orders inside a region
//   - fetching all regions in parallel and fetch the orders inside a region
//     sequentially
// Though the first approach was more simple to write it turned out to be
// significantly slower (~7min against ~3min for the second approach).
// EDIT: Just fetching orders and regions sequentially works fine 👉👈
func Download(ctx context.Context) error {
	orders := make([]dbOrder, 0, 1000)

	for _, regionId := range regions.Regions {
		var pageOrders []dbOrder
		var err error
		var pages int

		for p := 1; p <= pages || p == 1; p++ {
			pageOrders, pages, err = fetchPageOrders(ctx, regionId, p)
			if err != nil {
				return fmt.Errorf("fetching page %d from region %d: %w", p, regionId, err)
			}
			// this slices are quite big, lets hop the gc does a great job...
			orders = append(orders, pageOrders...)
		}
	}

	err := dbReplaceOrders(ctx, orders)
	if err != nil {
		return fmt.Errorf("replacing orders: %w", err)
	}

	return nil
}
