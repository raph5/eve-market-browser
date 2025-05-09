package metrics

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"testing"
  "time"
)

//go:embed testdata/order-sample.json
var rawOrderSample []byte

func loadOrderSample() []dbOrder {
  var orderSample []dbOrder
  err := json.Unmarshal(rawOrderSample, &orderSample)
  if err != nil {
    fmt.Println(err)
    panic("could not load order sample")
  }
  return orderSample
}

func TestHotDataPoint(t *testing.T) {
  now := time.Now()
  orderSample := loadOrderSample()
  dataPoints := computeHotDataPoints(now, orderSample)

  if len(dataPoints) != 4 {
    t.Errorf("got: %v", dataPoints)
  }
  for _, dp := range dataPoints {
    var want hotDataPoint
    if dp.typeId == 34133 && dp.regionId == 10000002 {
      want = hotDataPoint{typeId: 34133, regionId: 10000002, time: now, buyPrice: 2567000000, sellPrice: 2976000000}
    } else if dp.typeId == 34133 && dp.regionId == 10000043 {
      want = hotDataPoint{typeId: 34133, regionId: 10000043, time: now, buyPrice: 2193000000, sellPrice: 3148000000}
    } else if dp.typeId == 40519 && dp.regionId == 10000002 {
      want = hotDataPoint{typeId: 40519, regionId: 10000002, time: now, buyPrice: 536200000, sellPrice: 546900000}
    } else if dp.typeId == 40519 && dp.regionId == 10000043 {
      want = hotDataPoint{typeId: 40519, regionId: 10000043, time: now, buyPrice: 513700000, sellPrice: 550000000}
    } else {
      t.Errorf("got: %v", dp)
    }
    if dp != want {
      t.Errorf("got: %v", dp)
    }
  }
}
