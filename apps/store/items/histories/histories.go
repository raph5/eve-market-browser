package histories

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/items/activemarkets"
	"github.com/raph5/eve-market-browser/apps/store/items/metrics"
	"github.com/raph5/eve-market-browser/apps/store/lib/esi"
)

const chunkSize = 128

func Download(ctx context.Context) error {
	activeMarketsCount, err := activemarkets.Count(ctx)
	if err != nil {
		return fmt.Errorf("cant get activeMarkets count: %w", err)
	}

	for offset := 0; offset < activeMarketsCount; offset += chunkSize {
		activeMarketsChunk, err := activemarkets.GetChunk(ctx, offset, chunkSize)
		if err != nil {
			return err
		}

		var historiesChunk []dbHistory
		for trails := 0; trails < 3; trails++ {
			historiesChunk, err = fetchHistoriesChunk(ctx, activeMarketsChunk)
			if err == nil {
				break
			}
			var esiErr *esi.EsiError
			if errors.As(err, &esiErr) {
				return fmt.Errorf("chunk download stoped by esi error: %w", err)
			}

			log.Printf("History chunk error, retry downloading the chunk after 5 mintues: %v", err)
			timer := time.NewTimer(5 * time.Minute)
			select {
			case <-timer.C:
			case <-ctx.Done():
				if !timer.Stop() {
					<-timer.C
				}
				return ctx.Err()
			}
		}
		if err != nil {
			return fmt.Errorf("history chunk failed 3 times: %w", err)
		}

		err = dbInsertHistories(ctx, historiesChunk)
		if err != nil {
			return fmt.Errorf("failed to insert history chunk to db: %w", err)
		}
	}

	return nil
}

// NOTE: I should be hable to speed up this function (that takes currently ~7h)
// by batching DB calls
func ComputeGobalHistories(ctx context.Context, today time.Time) error {
	metricsEnabled := ctx.Value("metricsEnabled").(bool)

	activeMarketsId, err := activemarkets.GetTypesId(ctx)
	if err != nil {
		return err
	}

	var dayDataPoints []metrics.DayDataPoint
	if metricsEnabled {
		dayDataPoints = make([]metrics.DayDataPoint, 0, len(activeMarketsId))
	}

	for _, typeId := range activeMarketsId {
		if err := ctx.Err(); err != nil {
			return err
		}

		histories, err := dbGetHistoriesOfType(ctx, typeId)
		if err != nil {
			log.Printf("Can't get histories of type %d: %v", typeId, err)
			continue
		}
		histories = filterOutEmptyHistories(histories)

		err = computeGlobalHistoryOfType(ctx, histories, typeId)
		if err != nil {
			log.Printf("Can't compute global history for type %d: %v", typeId, err)
			continue
		}

		if metricsEnabled {
			regionDataPoint, err := metrics.ComputeDayDataPoints(ctx, typeId, histories, today)
			if err != nil {
				log.Printf("CreateRegionDayDataPoints: %v\n", err)
				continue
			}
			dayDataPoints = append(dayDataPoints, regionDataPoint...)
		}
	}

	if metricsEnabled {
		err = metrics.InsertDayDataPoints(ctx, dayDataPoints)
		if err != nil {
			log.Printf("InsertDatDataPoints: %v\n", err)
		}
		metrics.ClearBefore(today)
	}

	return nil
}

func computeGlobalHistoryOfType(ctx context.Context, histories []dbHistory, typeId int) error {
	regions := len(histories)

	if regions == 0 {
		// return fmt.Errorf("empty historiesOfType for type %d", typeId)
		// here I do not throw as in practice I get a few empty ones
		return nil
	}

	if regions == 1 {
		histories[0].RegionId = 0
		err := dbInsertHistory(ctx, histories[0])
		if err != nil {
			return fmt.Errorf("can't insert history: %w", err)
		}
		return nil
	}

	esiHistories := make([][]esiHistoryDay, regions)
	for i, h := range histories {
		err := json.Unmarshal(h.History, &esiHistories[i])
		if err != nil {
			return fmt.Errorf("can't unmarshal history: %w", err)
		}
	}

	var firstDate, lastDate time.Time
	for _, ehd := range esiHistories {
		fd, err := time.Parse(esi.DateLayout, ehd[0].Date)
		if err != nil {
			return fmt.Errorf("can't parse date: %w", err)
		}
		ld, err := time.Parse(esi.DateLayout, ehd[len(ehd)-1].Date)
		if err != nil {
			return fmt.Errorf("can't parse date: %w", err)
		}
		if firstDate.IsZero() || fd.Before(firstDate) {
			firstDate = fd
		}
		if lastDate.IsZero() || ld.After(lastDate) {
			lastDate = ld
		}
	}
	deltaDays := int(lastDate.Sub(firstDate).Hours() / 24)
	globalEsiHistoryDays := make([]esiHistoryDay, deltaDays+1)

	offsets := make([]int, regions)
	for i, d := 0, firstDate; i < deltaDays+1; i, d = i+1, d.AddDate(0, 0, 1) {
		for j := 0; j < regions; j++ {
			if offsets[j]+i >= len(esiHistories[j]) {
				continue
			}

			day := esiHistories[j][offsets[j]+i]
			date, err := time.Parse(esi.DateLayout, day.Date)
			if err != nil {
				return fmt.Errorf("can't parse date: %w", err)
			}
			if !date.Equal(d) {
				offsets[j]--
				continue
			}

			gDay := &globalEsiHistoryDays[i]
			if gDay.Date == "" {
				*gDay = day
			} else {
				if day.Volume > 0 {
					gDay.Average = (gDay.Average*float64(gDay.Volume) + day.Average*float64(day.Volume)) /
						float64(gDay.Volume+day.Volume)
					if gDay.Volume == 0 {
						gDay.Lowest = day.Lowest
						gDay.Highest = day.Highest
					} else {
						gDay.Lowest = min(gDay.Lowest, day.Lowest)
						gDay.Highest = max(gDay.Highest, day.Highest)
					}
				}
				gDay.Date = day.Date
				gDay.OrderCount += day.OrderCount
				gDay.Volume += day.Volume
			}
		}
		if globalEsiHistoryDays[i].Date == "" {
			if i == 0 {
				panic("impossible point to reach")
			}
			// NOTE: It might be a good idea to set OrderCount to -1 and display
			// "Unknown OrderCount" in the ui
			globalEsiHistoryDays[i].Volume = 0
			globalEsiHistoryDays[i].OrderCount = 0
			globalEsiHistoryDays[i].Date = d.Format(esi.DateLayout)
			globalEsiHistoryDays[i].Lowest = globalEsiHistoryDays[i-1].Average
			globalEsiHistoryDays[i].Highest = globalEsiHistoryDays[i-1].Average
			globalEsiHistoryDays[i].Average = globalEsiHistoryDays[i-1].Average
		}
	}

	globalHistoryDays, err := esiToDbHistoryDays(globalEsiHistoryDays)
	if err != nil {
		return fmt.Errorf("esi to db history: %w", err)
	}
	globalHistoryDaysJson, err := json.Marshal(globalHistoryDays)
	if err != nil {
		return fmt.Errorf("history marshal: %w", err)
	}
	globalHistory := dbHistory{
		History:  globalHistoryDaysJson,
		RegionId: 0,
		TypeId:   typeId,
	}

	err = dbInsertHistory(ctx, globalHistory)
	if err != nil {
		return fmt.Errorf("can't insert history: %w", err)
	}

	return nil
}

func filterOutEmptyHistories(histories []dbHistory) []dbHistory {
	filteredHistories := make([]dbHistory, 0, len(histories))
	for i := range histories {
		if string(histories[i].History) != "[]" {
			filteredHistories = append(filteredHistories, histories[i])
		}
	}
	return filteredHistories
}
