package main

import (
	emd "github.com/raph5/eve-market-dump"
)

type tickMetric struct {
  typeId uint64
  locationId uint64
  average float64
  volume uint64
}

func getTickMeitrcs(oldOrders []emd.Order, newOrders []emd.Order) []tickMetric {
  type metric struct {
    average float64
    volume uint64
  }
  type market struct {
    typeId uint64
    locationId uint64
  }
  tickMetricMap := make(map[market]metric)

  type orderFingerPrint struct {
    orderId uint64
    locationId uint64
    isBuyOrder bool
    volumeTotal uint64
  }
  newOrderByFingerPrint := make(map[orderFingerPrint]*emd.Order)
  for i := range newOrders {
    fingerPrint := orderFingerPrint{
      orderId: newOrders[i].OrderId,
      locationId: newOrders[i].LocationId,
      isBuyOrder: newOrders[i].IsBuyOrder,
      volumeTotal: newOrders[i].VolumeTotal,
    }
    newOrderByFingerPrint[fingerPrint] = &newOrders[i]
  }

  for _, o := range oldOrders {
    fingerPrint := orderFingerPrint{
      orderId: o.OrderId,
      locationId: o.LocationId,
      isBuyOrder: o.IsBuyOrder,
      volumeTotal: o.VolumeTotal,
    }
    newO, ok := newOrderByFingerPrint[fingerPrint]
    if ok && newO.VolumeRemain < o.VolumeRemain {  // order used
      market := market{o.TypeId, o.LocationId}
      volume := o.VolumeRemain - newO.VolumeRemain
      var price float64
      if o.IsBuyOrder {
        price = max(o.Price, newO.Price)
      } else {
        price = min(o.Price, newO.Price)
      }

      tickMetric, ok := tickMetricMap[market]
      if ok {
        tickMetricMap[market] = metric{
          average: (tickMetric.average * float64(tickMetric.volume) + price * float64(volume)) /
            float64(tickMetric.volume + volume),
          volume: volume,
        }
      } else {
        tickMetricMap[market] = metric{price, volume}
      }
    } else if !ok {  // order complited
      market := market{o.TypeId, o.LocationId}

      tickMetric, ok := tickMetricMap[market]
      if ok {
        tickMetricMap[market] = metric{
          average: (tickMetric.average * float64(tickMetric.volume) + o.Price * float64(o.VolumeRemain)) /
            float64(tickMetric.volume + o.VolumeRemain),
          volume: o.VolumeRemain,
        }
      } else {
        tickMetricMap[market] = metric{o.Price, o.VolumeRemain}
      }
    }
  }

  tickMetrics := make([]tickMetric, 0, len(tickMetricMap))
  for market := range tickMetricMap {
    tickMetrics = append(tickMetrics, tickMetric{
      typeId: market.typeId,
      locationId: market.locationId,
      average: tickMetricMap[market].average,
      volume: tickMetricMap[market].volume,
    })
  }

  return tickMetrics
}
