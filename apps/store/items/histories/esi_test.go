package histories

import (
	"context"
	"fmt"
	"testing"
)

var testEsiHistoryDays = []esiHistoryDay{
	{
		Average:    6018000,
		Date:       "2024-12-25",
		Highest:    6144000,
		Lowest:     6000000,
		OrderCount: 1739,
		Volume:     833459,
	},
	{
		Average:    6003000,
		Date:       "2024-12-27",
		Highest:    6165000,
		Lowest:     6000000,
		OrderCount: 2517,
		Volume:     871308,
	},
	{
		Average:    6000000,
		Date:       "2024-12-28",
		Highest:    6008000,
		Lowest:     5997000,
		OrderCount: 2877,
		Volume:     931539,
	},
}

var testDbHistoryDays = []dbHistoryDay{
	{
		Average:        6018000,
		Average5d:      6018000,
		Average20d:     6018000,
		Date:           "2024-12-25",
		Highest:        6144000,
		Lowest:         6000000,
		OrderCount:     1739,
		Volume:         833459,
		DonchianTop:    6144000,
		DonchianBottom: 6000000,
	},
	{
		Average:        6018000,
		Average5d:      6018000,
		Average20d:     6018000,
		Date:           "2024-12-26",
		Highest:        6018000,
		Lowest:         6018000,
		OrderCount:     1739,
		Volume:         0,
		DonchianTop:    6144000,
		DonchianBottom: 6000000,
	},
	{
		Average:        6003000,
		Average5d:      6015500,
		Average20d:     6017285.714285715,
		Date:           "2024-12-27",
		Highest:        6165000,
		Lowest:         6000000,
		OrderCount:     2517,
		Volume:         871308,
		DonchianTop:    6165000,
		DonchianBottom: 6000000,
	},
	{
		Average:        6000000,
		Average5d:      6012500,
		Average20d:     6016428.571428572,
		Date:           "2024-12-28",
		Highest:        6008000,
		Lowest:         5997000,
		OrderCount:     2877,
		Volume:         931539,
		DonchianTop:    6165000,
		DonchianBottom: 5997000,
	},
}

func areDaysEqual(d1 *dbHistoryDay, d2 *dbHistoryDay) bool {
	return d1.Average == d2.Average &&
		d1.Average5d == d2.Average5d &&
		d1.Average20d == d2.Average20d &&
		d1.Date == d2.Date &&
		d1.Highest == d2.Highest &&
		d1.Lowest == d2.Lowest &&
		d1.OrderCount == d2.OrderCount &&
		d1.Volume == d2.Volume &&
		d1.DonchianTop == d2.DonchianTop &&
		d1.DonchianBottom == d2.DonchianBottom
}

func TestEsiToDbHistory(t *testing.T) {
	dbHistoryDays, err := esiToDbHistoryDays(testEsiHistoryDays)
	if err != nil {
		t.Fatal(err)
	}

	fmt.Println(dbHistoryDays)

	for i := range dbHistoryDays {
		if !areDaysEqual(&dbHistoryDays[i], &testDbHistoryDays[i]) {
			t.Fatalf("history day missmatch: want %v, got %v", testDbHistoryDays[i], dbHistoryDays[i])
		}
	}
}
