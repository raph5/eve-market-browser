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
	"time"

	"github.com/raph5/eve-market-browser/apps/store/esi"
)

type esiHistoryDay struct {
  Average     float64 `json:"average"`
  Date        string `json:"date"`
  Highest     float64 `json:"highest"`
  Lowest      float64 `json:"lowest"`
  Order_count int `json:"order_count"`
  Volume      int `json:"volume"`
}

type historyDay struct {
	Date           string  `json:"date"`
	Average        float64 `json:"average"`
	Average5d      float64 `json:"average5d"`
	Average20d     float64 `json:"average20d"`
	Highest        float64 `json:"highest"`
	Lowest         float64 `json:"lowest"`
	OrderCount     int     `json:"orderCount"`
	Volume         int     `json:"volume"`
	DonchianTop    float64 `json:"donchianTop"`
	DonchianBottom float64 `json:"donchianBottom"`
}

type historyData struct {
  history  []byte
  typeId   int
  regionId int
}

const chunkSize = 100

func createHisoryHandler(ctx context.Context) http.HandlerFunc {
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

    var historyJson []byte
    historyQuery := `
    SELECT HistoryJson FROM History
      WHERE TypeId = ? AND RegionId = ?;
    `
    err = readDB.QueryRow(historyQuery, typeId, regionId).Scan(&historyJson)
    if err != nil {
      if errors.Is(err, sql.ErrNoRows) {
        historyJson, err = fetchHistory(ctx, typeId, regionId)
        if err != nil {
          esiError, ok := err.(*esi.EsiError)
          if ok {
            log.Print(esiError)
            http.Error(w, esiError.Message, esiError.Code)
            return
          }
          log.Printf("Internal server error: %v", err)
          http.Error(w, "Internal server error", 500)
          return
        }
      } else {
        log.Printf("Internal server error: %v", err)
        http.Error(w, "Internal server error", 500)
        return
      }
    }

    w.Header().Set("Content-Type", "application/json")
    w.Write(historyJson)
  }
}

func downloadHistories(ctx context.Context) error {
  offset := 0
  for {
    activeTypeChunk, err := getActiveTypes(ctx, offset, chunkSize)
    if err != nil {
      return err
    }
    if len(activeTypeChunk) == 0 {
      return nil
    }

    err = downloadHistoriesChunk(ctx, activeTypeChunk)
    if err != nil {
      return err
    }

    if len(activeTypeChunk) != chunkSize {
      return nil
    }
    offset += chunkSize
  }
}

func downloadHistoriesChunk(ctx context.Context, activeTypeChunk []activeType) error {
  writeDB := ctx.Value("writeDB").(*sql.DB)
  localCtx, localCancel := context.WithCancelCause(ctx)
  defer localCancel(nil)
  var wg sync.WaitGroup
  activeTypeCh := make(chan activeType, len(activeTypeChunk))
  historyDataCh := make(chan historyData, len(activeTypeChunk))

  // the workers will run until the active type channel is cloed
  wg.Add(esi.MaxConcurrentRequests)
  for i := 0; i < esi.MaxConcurrentRequests; i++ {
    go func() {
      defer wg.Done()
      for at := range activeTypeCh {
        history, err := fetchHistory(ctx, at.typeId, at.regionId)
        if err != nil {
          localCancel(err)
          return
        }
        historyDataCh <- historyData{
          typeId: at.typeId,
          regionId: at.regionId,
          history: history,
        }
      }
    }()
  }

  // feed active types to the workers through the active type channel
  // this channel will be closed in case of a cancel
  go func() {
    defer close(activeTypeCh)
    for _, at := range activeTypeChunk {
      select {
      case activeTypeCh <- at:
      case <-localCtx.Done():
        return
      }
    }
  }()

  // close the history channel when workers are finished or canceled
  wg.Wait()
  err := context.Cause(ctx)
  if err != nil {
    return err
  }
  close(historyDataCh)

  // store history data
  tx, err := writeDB.Begin()
  if err != nil {
    return err
  }
  defer tx.Rollback()
  stmt, err := tx.Prepare("INSERT OR REPLACE INTO History VALUES (?,?,?)")
  if err != nil {
    return err
  }
  defer stmt.Close()

  for hd := range historyDataCh {
    _, err = stmt.Exec(hd.typeId, hd.regionId, hd.history)
    if err != nil {
      localCancel(err)
      wg.Wait()
      break
    }
  }

  err = tx.Commit()
  if err != nil {
    return err
  }

  return nil
}

func fetchHistory(ctx context.Context, typeId int, regionId int) ([]byte, error) {
  uri := fmt.Sprintf("/markets/%d/history", regionId)
  query := map[string]string{
    "type_id": strconv.Itoa(typeId),
  }
  esiHistory, err := esi.EsiFetch[[]esiHistoryDay](ctx, uri, "GET", query, nil, 3, 5)
  if err != nil {
    return nil, err
  }

  history, err := processHistory(esiHistory)
  if err != nil {
    return nil, err
  }
  jsonHistory, err := json.Marshal(history)
  if err != nil {
    return nil, err
  }

  return jsonHistory, nil
}

func processHistory(esiHistory []esiHistoryDay) ([]historyDay, error) {
  if len(esiHistory) == 0 {
    return []historyDay{}, nil
  }

  day, err := time.Parse(esi.DateLayout, esiHistory[0].Date)
  if err != nil {
    return nil, err
  }
  lastDay, err := time.Parse(esi.DateLayout, esiHistory[len(esiHistory)-1].Date)
  if err != nil {
    return nil, err
  }
  deltaDays := int(lastDay.Sub(day).Hours() / 24)
  history := make([]historyDay, deltaDays+1)

  // copy data from esiHistory to history and add missing days
  i := 0
  j := 0
  d := day
  for {
    if d.Equal(day) {
      history[j].Volume = esiHistory[i].Volume
      history[j].Date = esiHistory[i].Date
      history[j].Lowest = esiHistory[i].Lowest
      history[j].Highest = esiHistory[i].Highest
      history[j].Average = esiHistory[i].Average
      history[j].OrderCount = esiHistory[i].Order_count
      i += 1
      if i >= len(esiHistory) {
        break
      }
      d, err = time.Parse(esi.DateLayout, esiHistory[i].Date)
      if err != nil {
        return nil, err
      }
    } else {
      history[j].Volume = 0
      history[j].Date = day.Format(esi.DateLayout)
      history[j].Lowest = esiHistory[i-1].Average
      history[j].Highest = esiHistory[i-1].Average
      history[j].Average = esiHistory[i-1].Average
      history[j].OrderCount = esiHistory[i-1].Order_count
    }
    j += 1
    if j >= len(history) {
      return nil, errors.New("Index out of bounds in history processing")
    }
    day = day.AddDate(0, 0, 1)
  }

  history[0].Average5d = history[0].Average
  history[0].Average20d = history[0].Average
  history[0].DonchianTop = history[0].Highest
  history[0].DonchianBottom = history[0].Lowest
  for i := 1; i < len(history); i++ {
    // comput rolling average 5 days
    avg5 := (6*history[i-1].Average5d -
      history[max(0, i-6)].Average +
      history[i].Average) / 6

    // comput rolling average 20 days
    avg20 := (21*history[i-1].Average20d -
      history[max(0, i-21)].Average +
      history[i].Average) / 21

    // comput donchian top
    var dcTop float64
    if history[i-1].DonchianTop == history[max(0, i-6)].Highest {
      j := max(0, i-5)
      dcTop = history[j].Highest
      for j = j + 1; j <= i; j++ {
        if history[j].Highest > dcTop {
          dcTop = history[j].Highest
        }
      }
    } else {
      dcTop = max(history[i-1].DonchianTop, history[i].Highest)
    }

    // comput donchian bottom
    var dcBottom float64
    if history[i-1].DonchianBottom == history[max(0, i-6)].Lowest {
      j := max(0, i-5)
      dcBottom = history[j].Lowest
      for j = j + 1; j <= i; j++ {
        if history[j].Lowest < dcBottom {
          dcBottom = history[j].Lowest
        }
      }
    } else {
      dcBottom = min(history[i-1].DonchianBottom, history[i].Lowest)
    }

    history[i].Average5d = avg5
    history[i].Average20d = avg20
    history[i].DonchianTop = dcTop
    history[i].DonchianBottom = dcBottom
  }

  return history, nil
}
