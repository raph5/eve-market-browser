package commodities

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/diskStorage"
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
type HistoryDay struct {
	Date           string  `json:"date"`
	Average        float64 `json:"average"`
	Average5d      float64 `json:"average_5d"`
	Average20d     float64 `json:"average_20d"`
	Highest        float64 `json:"highest"`
	Lowest         float64 `json:"lowest"`
	OrderCount     int     `json:"order_count"`
	Volume         int     `json:"volume"`
	DonchianTop    float64 `json:"donchian_top"`
	DonchianBottom float64 `json:"donchian_bottom"`
}

const historyWorkerCount = 200

var historyStorageReady = make(chan struct{})

func HistoryWroker() {
  // get types
	<-typeStorageReady
	typesData, err := getTypes()
	if err != nil {
		log.Fatal(err)
	}
	types := make([]int, len(typesData))
	for i := range typesData {
		types[i] = typesData[i].Id
	}
	typesData = nil

  // get regions
	<-regionStorageReady
	regionsData, err := getRegions()
	if err != nil {
		log.Fatal(err)
	}
	regions := make([]int, len(regionsData))
	for i := range regionsData {
		regions[i] = regionsData[i].Id
	}
	regionsData = nil

  // start workers
  jobs := make(chan int)
  for i := 0; i < historyWorkerCount; i++ {
    go func(jobsChan <-chan int, regions []int) {
      for j := range jobsChan {
        err := setHistory(j, regions)
        if err != nil {
          log.Printf("Can't get orders from type %d : %s", j, err.Error())
        }
      }
    }(jobs, regions)
  }

  // work assignment loop
  for {
    expirationDate, ok, err := diskStorage.ReadIndex[float64]("history")
    if err != nil {
      log.Fatal(err)
    }
    timeToWait := int64(expirationDate) - time.Now().Unix()

    if ok && timeToWait > 0 {
      time.Sleep(time.Duration(timeToWait) * time.Second)
      continue
    }

    for _, t := range types {
      jobs <- t
    }

    diskStorage.WriteIndex("history", getHistoryExpirationTime())
  }
}

func HandleHistoryRequest(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	typeId, err := strconv.Atoi(query.Get("type"))
	if err != nil {
		http.Error(w, "Bad Request", 400)
		return
	}

	region := query.Get("region")
	regionId := 0
	if region != "all" {
		regionId, err = strconv.Atoi(region)
		if err != nil {
			http.Error(w, "Bad Request", 400)
			return
		}
	}

	fileName := getOrdersFileName(typeId, regionId)
	if !diskStorage.Exist(fileName) {
		http.Error(w, "Internal Server Error", 500)
		return
	}

	cacheFile := diskStorage.GetFile(fileName)
	diskStorage.Serve(w, r, cacheFile)
}

func getHistory(typeId int, regionId int) ([]HistoryDay, error) {
	history := make([]HistoryDay, 0, 1000)
	fileName := getHistoryFileName(typeId, regionId)
	file, err := diskStorage.Read(fileName)
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(file, &history)
	if err != nil {
		return nil, err
  }
	return history, nil
}

func setHistory(typeId int, regions []int) error {
  log.Println(typeId)

	// fetch esiHistoryByRegion
	esiHistoryByRegion := make(map[int][]esiHistoryDay)
	for _, regionId := range regions {
		uri := fmt.Sprintf("/markets/%d/history", regionId)
		query := map[string]string{
			"type_id": strconv.Itoa(typeId),
		}
		history, err := esi.EsiFetch[[]esiHistoryDay](uri, "GET", query, nil)
    log.Println(uri, typeId)
		if err != nil {
			return err
		}
		esiHistoryByRegion[regionId] = history
	}

	// historyByRegion init
	historyByRegion := make(map[int][]HistoryDay)
  var startDay, endDay time.Time
  for _, r := range regions {
    if len(esiHistoryByRegion[r]) == 0 {
      continue
    }
		sd, err := time.Parse(esi.EsiDateLayout, esiHistoryByRegion[r][0].Date)
		if err != nil {
      return err
		}
		ed, err := time.Parse(esi.EsiDateLayout, esiHistoryByRegion[r][len(esiHistoryByRegion[r])-1].Date)
		if err != nil {
      return err
		}
		if startDay.IsZero() || sd.Before(startDay) {
			startDay = sd
		}
		if endDay.IsZero() || ed.After(endDay) {
			endDay = ed
		}
	}
  
	// comput esiHistory for regions "all"
	esiHistoryByRegion[0] = make([]esiHistoryDay, int(endDay.Sub(startDay).Hours()/24)+1)
	i := 0
	iByRegion := make(map[int]int)
	day := startDay
	for day.Before(endDay) || day.Equal(endDay) {
		for _, r := range regions {
			if iByRegion[r] >= len(esiHistoryByRegion[r]) {
				continue
			}

			h := esiHistoryByRegion[r][iByRegion[r]]
			d, err := time.Parse(esi.EsiDateLayout, h.Date)
			if err != nil {
        return err
			}
			if !d.Equal(day) {
				continue
			}

			esiHistoryByRegion[0][i].Date = h.Date
			esiHistoryByRegion[0][i].Average = (esiHistoryByRegion[0][i].Average*float64(esiHistoryByRegion[0][i].Volume) +
				h.Average*float64(h.Volume)) / float64(esiHistoryByRegion[0][i].Volume+h.Volume)
			esiHistoryByRegion[0][i].Order_count += h.Order_count
			esiHistoryByRegion[0][i].Volume += h.Volume
			if esiHistoryByRegion[0][i].Lowest == 0 || h.Lowest < esiHistoryByRegion[0][i].Lowest {
				esiHistoryByRegion[0][i].Lowest = h.Lowest
			}
			if h.Highest > esiHistoryByRegion[0][i].Highest {
				esiHistoryByRegion[0][i].Highest = h.Highest
			}

			iByRegion[r] += 1
		}

		i += 1
		day = day.AddDate(0, 0, 1)
	}

	// process esiHistoryByRegion to fill historyByRegion
	for _, r := range regions {
    if len(esiHistoryByRegion[r]) == 0 {
      historyByRegion[r] = []HistoryDay{}
      continue
    }

		historyByRegion[r] = make([]HistoryDay, len(esiHistoryByRegion[r]))
		historyByRegion[r][0].Date = esiHistoryByRegion[r][0].Date
		historyByRegion[r][0].Average = esiHistoryByRegion[r][0].Average
		historyByRegion[r][0].Average5d = esiHistoryByRegion[r][0].Average
		historyByRegion[r][0].Average20d = esiHistoryByRegion[r][0].Average
		historyByRegion[r][0].Highest = esiHistoryByRegion[r][0].Highest
		historyByRegion[r][0].Lowest = esiHistoryByRegion[r][0].Lowest
		historyByRegion[r][0].OrderCount = esiHistoryByRegion[r][0].Order_count
		historyByRegion[r][0].Volume = esiHistoryByRegion[r][0].Volume
		historyByRegion[r][0].DonchianTop = esiHistoryByRegion[r][0].Highest
		historyByRegion[r][0].DonchianBottom = esiHistoryByRegion[r][0].Lowest

		day, err := time.Parse(esi.EsiDateLayout, esiHistoryByRegion[r][0].Date)
		if err != nil {
      return err
		}
		for i := 1; i < len(esiHistoryByRegion[r]); i++ {
			// fill the gaps
			d, err := time.Parse(esi.EsiDateLayout, esiHistoryByRegion[r][i].Date)
			if err != nil {
        return err
			}
			if !d.Equal(day) {
				esiHistoryByRegion[r] = append(esiHistoryByRegion[r][:i+1], esiHistoryByRegion[r][i:]...)
				esiHistoryByRegion[r][i].Date = day.Format(esi.EsiDateLayout)
				esiHistoryByRegion[r][i].Average = esiHistoryByRegion[r][i-1].Average
				esiHistoryByRegion[r][i].Lowest = esiHistoryByRegion[r][i-1].Average
				esiHistoryByRegion[r][i].Highest = esiHistoryByRegion[r][i-1].Average
				esiHistoryByRegion[r][i].Order_count = esiHistoryByRegion[r][i-1].Order_count
				esiHistoryByRegion[r][i].Volume = 0
			}
			h := esiHistoryByRegion[r][i]

			// comput average 5
			avg5 := (6*historyByRegion[r][i-1].Average5d -
				historyByRegion[r][max(0, i-6)].Average +
				h.Average) / 6

			// comput average 20
			avg20 := (21*historyByRegion[r][i-1].Average20d -
				historyByRegion[r][max(0, i-21)].Average +
				h.Average) / 21

			// comput donchian top
			var dcTop float64
			if historyByRegion[r][i-1].DonchianTop == historyByRegion[r][max(0, i-6)].Highest {
				j := max(0, i-5)
				dcTop = historyByRegion[r][j].Highest
        for j = j + 1; j <= i; j++ {
          if historyByRegion[r][j].Highest > dcTop {
            dcTop = historyByRegion[r][j].Highest
          }
        }
      } else {
				dcTop = max(historyByRegion[r][i-1].DonchianTop, h.Highest)
			}

			// comput donchian bottom
			var dcBottom float64
			if historyByRegion[r][i-1].DonchianBottom == historyByRegion[r][max(0, i-6)].Lowest {
				j := max(0, i-5)
				dcBottom = historyByRegion[r][j].Lowest
        for j = j + 1; j <= i; j++ {
          if historyByRegion[r][j].Lowest < dcBottom {
            dcBottom = historyByRegion[r][j].Lowest
          }
				}
			} else {
				dcBottom = min(historyByRegion[r][i-1].DonchianBottom, h.Lowest)
			}

			hc := HistoryDay{
				Date:           h.Date,
				Average:        h.Average,
				Average5d:      avg5,
				Average20d:     avg20,
				Highest:        h.Highest,
				Lowest:         h.Lowest,
				OrderCount:     h.Order_count,
				Volume:         h.Volume,
				DonchianTop:    dcTop,
				DonchianBottom: dcBottom,
			}
			historyByRegion[r] = append(historyByRegion[r], hc)
			day = day.AddDate(0, 0, 1)
		}
	}

	// save history
	for region, history := range historyByRegion {
		jsonData, err := json.Marshal(history)
		if err != nil {
			return err
		}

		fileName := getHistoryFileName(typeId, region)
		err = diskStorage.Write(fileName, jsonData)
		if err != nil {
			return err
		}
	}

	return nil
}

func getHistoryExpirationTime() int64 {
	now := time.Now()
	elevenFifteenTomorrow := time.Date(now.Year(), now.Month(), now.Day(), 11, 15, 0, 0, now.Location())
	if elevenFifteenTomorrow.Before(now) {
		elevenFifteenTomorrow = elevenFifteenTomorrow.AddDate(0, 0, 1)
	}
	return elevenFifteenTomorrow.Unix()
}

// region 0 commespond to all regions
func getHistoryFileName(typeId int, regionId int) string {
	if regionId == 0 {
		return fmt.Sprintf("history-%d/all.json", typeId)
	} else {
		return fmt.Sprintf("history-%d/%d.json", regionId, typeId)
	}
}
