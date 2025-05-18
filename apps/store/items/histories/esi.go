package histories

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/items/activemarkets"
	"github.com/raph5/eve-market-browser/apps/store/items/shared"
	"github.com/raph5/eve-market-browser/apps/store/lib/esi"
)

type esiHistoryDay = shared.EsiHistoryDay

var ErrInvalidEsiData = errors.New("Invalid esi data")

func fetchHistoriesChunk(ctx context.Context, activeMarketChunk []activemarkets.ActiveMarket) ([]dbHistory, error) {
	timeoutCtx, timeoutCancel := context.WithTimeout(ctx, 15*time.Minute)
	errorCtx, errorCancel := context.WithCancelCause(timeoutCtx)
	defer timeoutCancel()

	histories := make([]dbHistory, len(activeMarketChunk))
	activeMarketCh := make(chan activemarkets.ActiveMarket, 4)
	historyCh := make(chan *dbHistory, 4)

	worker := func() {
		for am := range activeMarketCh {
			history, err := fetchHistory(errorCtx, am.RegionId, am.TypeId)
			if err != nil {
				var esiError *esi.EsiError
				if errors.As(err, &esiError) && (esiError.Code == 404 || esiError.Code == 400) {
					// NOTE: I can maybe handle 404, 400 errors better
					// log.Printf("History downloader: I cant fetch history of type %d in region %d due to a %d so I'll skip it.", am.TypeId, am.RegionId, esiError.Code)
					history = nil
				} else {
					errorCancel(fmt.Errorf("fetch history: %w", err))
					return
				}
			}
			// if 404, then send nil
			historyCh <- history
		}
	}

	for i := 0; i < esi.MaxConcurrentRequests; i++ {
		go worker()
	}

	go func() {
		defer close(activeMarketCh)
		for _, at := range activeMarketChunk {
			select {
			case activeMarketCh <- at:
			case <-errorCtx.Done():
				return
			}
		}
	}()

	for i := 0; i < len(activeMarketChunk); i++ {
		select {
		case h := <-historyCh:
			if h != nil {
				histories[i] = *h
			}
		case <-errorCtx.Done():
			return nil, context.Cause(errorCtx)
		}
	}

	return histories, nil
}

func fetchHistory(ctx context.Context, regionId int, typeId int) (*dbHistory, error) {
	uri := fmt.Sprintf("/markets/%d/history?type_id=%d", regionId, typeId)
	response, err := esi.EsiFetch[[]esiHistoryDay](ctx, "GET", uri, nil, false, 1, 5)
	if err != nil {
		return nil, fmt.Errorf("fetching esi history: %w", err)
	}
	esiHistoryDays := *response.Data
	dbHistoryDays, err := esiToDbHistoryDays(esiHistoryDays)
	if err != nil {
		return nil, fmt.Errorf("esi to db history: %w", err)
	}
	dbHistoryDaysJson, err := json.Marshal(dbHistoryDays)
	if err != nil {
		return nil, fmt.Errorf("marshal history: %w", err)
	}
	return &dbHistory{
		History:  dbHistoryDaysJson,
		RegionId: regionId,
		TypeId:   typeId,
	}, nil
}

func esiToDbHistoryDays(esiHistoryDays []esiHistoryDay) ([]dbHistoryDay, error) {
	if len(esiHistoryDays) == 0 {
		return make([]dbHistoryDay, 0), nil
	}

	firstDate, err := time.Parse(esi.DateLayout, esiHistoryDays[0].Date)
	if err != nil {
		return nil, fmt.Errorf("invalid date: %w", ErrInvalidEsiData)
	}
	lastDate, err := time.Parse(esi.DateLayout, esiHistoryDays[len(esiHistoryDays)-1].Date)
	if err != nil {
		return nil, fmt.Errorf("invalid date: %w", ErrInvalidEsiData)
	}
	deltaDate := int(lastDate.Sub(firstDate).Hours() / 24)
	if deltaDate < 0 || deltaDate > 1000 {
		return nil, fmt.Errorf("invalid date range: %w", ErrInvalidEsiData)
	}
	historyDays := make([]dbHistoryDay, deltaDate+1)

	// copy data from esiHistoryDays to historyDays and add missing days
	j := -1
	for i, d := 0, firstDate; i < len(historyDays); i, d = i+1, d.AddDate(0, 0, 1) {
		if j+1 >= len(esiHistoryDays) {
			return nil, fmt.Errorf("messed up date order: %w", ErrInvalidEsiData)
		}

		esiDate, err := time.Parse(esi.DateLayout, esiHistoryDays[j+1].Date)
		if err != nil {
			return nil, fmt.Errorf("invalid date: %w", ErrInvalidEsiData)
		}

		if esiDate.Equal(d) {
			j++
			historyDays[i].Volume = esiHistoryDays[j].Volume
			historyDays[i].Date = esiHistoryDays[j].Date
			historyDays[i].Lowest = esiHistoryDays[j].Lowest
			historyDays[i].Highest = esiHistoryDays[j].Highest
			historyDays[i].Average = esiHistoryDays[j].Average
			historyDays[i].OrderCount = esiHistoryDays[j].OrderCount
		} else {
			if j == -1 {
				panic("impossible point to reach")
			}
			historyDays[i].Volume = 0
			historyDays[i].Date = d.Format(esi.DateLayout)
			historyDays[i].Lowest = esiHistoryDays[j].Average
			historyDays[i].Highest = esiHistoryDays[j].Average
			historyDays[i].Average = esiHistoryDays[j].Average
			historyDays[i].OrderCount = esiHistoryDays[j].OrderCount
		}
	}

	historyDays[0].Average5d = historyDays[0].Average
	historyDays[0].Average20d = historyDays[0].Average
	historyDays[0].DonchianTop = historyDays[0].Highest
	historyDays[0].DonchianBottom = historyDays[0].Lowest
	for i := 1; i < len(historyDays); i++ {
		// comput rolling average 5 days
		avg5 := (6*historyDays[i-1].Average5d -
			historyDays[max(0, i-6)].Average +
			historyDays[i].Average) / 6

		// comput rolling average 20 days
		avg20 := (21*historyDays[i-1].Average20d -
			historyDays[max(0, i-21)].Average +
			historyDays[i].Average) / 21

		// comput donchian top
		var dcTop float64
		if historyDays[i-1].DonchianTop == historyDays[max(0, i-6)].Highest {
			j := max(0, i-5)
			dcTop = historyDays[j].Highest
			// NOTE: this loop will end because j < i
			for j = j + 1; j <= i; j++ {
				if historyDays[j].Highest > dcTop {
					dcTop = historyDays[j].Highest
				}
			}
		} else {
			dcTop = max(historyDays[i-1].DonchianTop, historyDays[i].Highest)
		}

		// comput donchian bottom
		var dcBottom float64
		if historyDays[i-1].DonchianBottom == historyDays[max(0, i-6)].Lowest {
			j := max(0, i-5)
			dcBottom = historyDays[j].Lowest
			// NOTE: this loop will end because j < i
			for j = j + 1; j <= i; j++ {
				if historyDays[j].Lowest < dcBottom {
					dcBottom = historyDays[j].Lowest
				}
			}
		} else {
			dcBottom = min(historyDays[i-1].DonchianBottom, historyDays[i].Lowest)
		}

		historyDays[i].Average5d = avg5
		historyDays[i].Average20d = avg20
		historyDays[i].DonchianTop = dcTop
		historyDays[i].DonchianBottom = dcBottom
	}

	return historyDays, nil
}
