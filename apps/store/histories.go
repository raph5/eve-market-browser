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
	Average    float64 `json:"average"`
	Date       string  `json:"date"`
	Highest    float64 `json:"highest"`
	Lowest     float64 `json:"lowest"`
	OrderCount int     `json:"order_count"`
	Volume     int     `json:"volume"`
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
				if regionId == 0 {
					log.Printf("History for type %d in region 0 is not available", typeId)
					http.Error(w, "History not available", 404)
					return
				}
				log.Printf("History cache miss on type %d in region %d, querying esi", typeId, regionId)
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
		activeTypesChunk, err := getActiveTypesChunk(ctx, offset, chunkSize)
		if err != nil {
			return err
		}
		if len(activeTypesChunk) == 0 {
			return nil
		}

		tries := 0
		for {
			tries += 1
			err = downloadHistoriesChunk(ctx, activeTypesChunk)
			if err == nil {
				break
			}
			_, isEsi := err.(*esi.EsiError)
			if tries >= 3 || isEsi {
				return err
			}
			log.Printf("History chunk error, retry downloading the chunk after 5 mintues: %v", err)
			select {
			case <-time.After(5 * time.Minute):
			case <-ctx.Done():
				return context.Canceled
			}
		}

		if len(activeTypesChunk) != chunkSize {
			return nil
		}
		offset += chunkSize
	}
}

func computeGobalHistory(ctx context.Context) error {
	activeTypesId, err := getActiveTypesId(ctx)
	if err != nil {
		return err
	}

	timeMap := make(map[string]time.Time)
	for _, typeId := range activeTypesId {
		if ctx.Err() != nil {
			return context.Canceled
		}
		err = computeTypeGlobalHistory(ctx, typeId, timeMap)
		if err != nil {
			log.Printf("Can't compute global history for type %d: %v", typeId, err)
		}
	}

	return nil
}

func downloadHistoriesChunk(ctx context.Context, activeTypeChunk []activeType) error {
	writeDB := ctx.Value("writeDB").(*sql.DB)
	localCtx, localCancel := context.WithCancelCause(ctx)
	defer localCancel(nil)
	var wg sync.WaitGroup
	activeTypeCh := make(chan activeType, len(activeTypeChunk))
	historyDataCh := make(chan historyData, len(activeTypeChunk))

	// the workers will run until the active type channel is cloed
	wg.Add(2 * esi.MaxConcurrentRequests)
	for i := 0; i < 2*esi.MaxConcurrentRequests; i++ {
		go func() {
			defer wg.Done()
			for at := range activeTypeCh {
				history, err := fetchHistory(ctx, at.typeId, at.regionId)
				if err != nil {
					esiError, ok := err.(*esi.EsiError)
					// NOTE: I can maybe handle 404, 400 errors better
					if !ok || esiError.Code != 404 && esiError.Code != 400 {
						localCancel(err)
						return
					}
				}
				historyDataCh <- historyData{
					typeId:   at.typeId,
					regionId: at.regionId,
					history:  history,
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
	err := context.Cause(localCtx)
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

func computeTypeGlobalHistory(ctx context.Context, typeId int, timeMap map[string]time.Time) error {
	writeDB := ctx.Value("writeDB").(*sql.DB)
	readDB := ctx.Value("readDB").(*sql.DB)

	rows, err := readDB.Query("SELECT HistoryJson, TypeId, RegionId FROM History WHERE TypeId = ? AND RegionId != 0", typeId)
	if err != nil {
		return err
	}
	defer rows.Close()

	globalHistoryMap := make(map[string]*historyDay)
	for rows.Next() {
		var typeId, regionId int
		var localHistoryJson []byte
		var localHistory []historyDay
		err = rows.Scan(&localHistoryJson, &typeId, &regionId)
		if err != nil {
			return err
		}
		err = json.Unmarshal(localHistoryJson, &localHistory)
		if err != nil {
			log.Printf("Can't unmarshal history for type %d in region %d: %v", typeId, regionId, err)
			continue
		}

		for _, lhd := range localHistory {
			_, ok := timeMap[lhd.Date]
			if !ok {
				t, err := time.Parse(esi.DateLayout, lhd.Date)
				if err != nil {
					return err
				}
				timeMap[lhd.Date] = t
			}

			ghd, ok := globalHistoryMap[lhd.Date]
			if ok {
				if lhd.Volume > 0 {
					ghd.Average = (ghd.Average*float64(ghd.Volume) + lhd.Average*
						float64(lhd.Volume)) / float64(ghd.Volume+lhd.Volume)
					if ghd.Volume == 0 {
						ghd.Lowest = lhd.Lowest
						ghd.Highest = ghd.Highest
					} else {
						ghd.Lowest = min(ghd.Lowest, lhd.Lowest)
						ghd.Highest = max(ghd.Highest, lhd.Highest)
					}
				}
				ghd.OrderCount += lhd.OrderCount
				ghd.Volume += lhd.Volume
			} else {
				lhdCopy := lhd
				globalHistoryMap[lhd.Date] = &lhdCopy
			}
		}
	}
	err = rows.Err()
	if err != nil {
		return err
	}

	globalHistorySorted := make([]esiHistoryDay, len(globalHistoryMap))
	for i := 0; i < len(globalHistorySorted); i++ {
		var firstTime time.Time
		var firstDay *historyDay
		for _, ghd := range globalHistoryMap {
			if firstTime.IsZero() || timeMap[ghd.Date].Before(firstTime) {
				firstTime = timeMap[ghd.Date]
				firstDay = ghd
			}
		}
		globalHistorySorted[i].Date = firstDay.Date
		globalHistorySorted[i].Lowest = firstDay.Lowest
		globalHistorySorted[i].Highest = firstDay.Highest
		globalHistorySorted[i].Volume = firstDay.Volume
		globalHistorySorted[i].OrderCount = firstDay.OrderCount
		globalHistorySorted[i].Average = firstDay.Average
		delete(globalHistoryMap, firstDay.Date)
	}

	globalHistory, err := processHistory(globalHistorySorted)
	if err != nil {
		return err
	}
	globalHistoryJson, err := json.Marshal(globalHistory)
	if err != nil {
		return err
	}
	_, err = writeDB.Exec("INSERT OR REPLACE INTO History VALUES (?,0,?)", typeId, globalHistoryJson)
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
	esiHistory, err := esi.EsiFetch[[]esiHistoryDay](ctx, uri, "GET", query, nil, 3, 12)
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
			history[j].OrderCount = esiHistory[i].OrderCount
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
			history[j].OrderCount = esiHistory[i-1].OrderCount
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
