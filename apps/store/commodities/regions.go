package commodities

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"slices"
	"sort"
	"strconv"

	"github.com/raph5/eve-market-browser/apps/store/diskStorage"
)

type Region struct {
	Id   int    `json:"id"`
	Name string `json:"name"`
}

const regionFile = "regions.json"

var regionStorageReady = make(chan struct{})
var hubRegions = []int{10000002, 10000043, 10000030, 10000032, 10000042}

func RegionsWorker() {
	if !diskStorage.Exist(regionFile) {
		log.Println("Fetching regions")
		err := setRegions()
		if err != nil {
			log.Fatal(err)
		}
		log.Println("Regions ready")
	}

	close(regionStorageReady)
}

func HandleRegionsRequest(w http.ResponseWriter, r *http.Request) {
	<-regionStorageReady

	cacheFile := diskStorage.GetFile(regionFile)
	diskStorage.Serve(w, r, cacheFile)
}

func getRegions() ([]Region, error) {
	regions := make([]Region, 0, 40)
	file, err := diskStorage.Read(regionFile)
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(file, &regions)
	if err != nil {
		return nil, err
	}
	return regions, nil
}

func setRegions() error {
	regionDump, err := http.Get("https://www.fuzzwork.co.uk/dump/latest/mapRegions.csv")
	if err != nil {
		return err
	}
	defer regionDump.Body.Close()

	if regionDump.StatusCode != 200 {
		return fmt.Errorf("fuzzwork response code : %d", regionDump.StatusCode)
	}

	reader := csv.NewReader(regionDump.Body)
	reader.Read()

	regions := make([]Region, len(hubRegions), 40)
	for {
		record, err := reader.Read()
		if err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		id, err := strconv.Atoi(record[0])
		if err != nil {
			return err
		}
		name := record[1]

		if id != 10000004 && id != 10000017 && id != 10000019 && id < 11000000 {
			hubIndex := slices.Index(hubRegions, id)
			if hubIndex == -1 {
				regions = append(regions, Region{Id: id, Name: name})
			} else {
				regions[hubIndex] = Region{Id: id, Name: name}
			}
		}
	}

	sort.Slice(regions[len(hubRegions):], func(i, j int) bool {
		return regions[len(hubRegions)+i].Name < regions[len(hubRegions)+j].Name
	})

	jsonData, err := json.Marshal(regions)
	if err != nil {
		log.Fatal(err)
	}

	err = diskStorage.Write(regionFile, jsonData)
	if err != nil {
		return err
	}

	return nil
}
