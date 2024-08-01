package commodities

import (
	"container/heap"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/raph5/eve-market-browser/apps/old-store/diskStorage"
	"github.com/raph5/eve-market-browser/apps/old-store/esi"
	utils "github.com/raph5/eve-market-browser/apps/old-store/jobsQueue"
)

type Order struct {
	Duration     int     `json:"duration"`
	IsBuyOrder   bool    `json:"is_buy_order"`
	Issued       string  `json:"issued"`
	LocationId   int     `json:"location_id"`
	MinVolume    int     `json:"min_volume"`
	OrderId      int     `json:"order_id"`
	Price        float64 `json:"price"`
	Range        string  `json:"range"`
	Systemid     int     `json:"system_id"`
	TypeId       int     `json:"type_id"`
	VolumeRemain int     `json:"volume_remain"`
	VolumeTotal  int     `json:"volume_total"`
}

const orderWorkersCount = 300
const orderPriorityBonus = 6 * 24 * 7

var priorityCredits = make(map[int]int)
var priorityCreditsMu = &sync.RWMutex{}
var ordersUpToDate = false

func OrdersWorker() {
	<-typeStorageReady
	typesData, err := getTypes()
	types := make([]int, len(typesData))
	if err != nil {
		log.Fatal(err)
	}
	for i := range typesData {
		types[i] = typesData[i].Id
	}
	typesData = nil

	<-regionStorageReady
	regionsData, err := getRegions()
	regions := make([]int, len(regionsData))
	if err != nil {
		log.Fatal(err)
	}
	for i := range regionsData {
		regions[i] = regionsData[i].Id
	}
	regionsData = nil

	// start workers
	jobs := make(chan int)
	for i := 0; i < orderWorkersCount; i++ {
		go func(jobsChan <-chan int, regions []int) {
			for j := range jobsChan {
				err := setOrders(j, regions)
				if err != nil {
					log.Printf("Can't get orders from type %d : %s", j, err.Error())
				}
			}
		}(jobs, regions)
	}

	// create job queue
	jobsQueue := make(utils.JobsQueue[int], 0, len(types))
	for _, t := range types {
		jobsQueue.Push(&utils.Job[int]{
			Payload: t,
			Time:    0,
		})
	}
	heap.Init(&jobsQueue)

	// work assignment loop
  // TODO: remove count
	count := 1
	for {
		log.Printf("Count : %d", count)
		count += 1

		x := heap.Pop(&jobsQueue)
		job := x.(*utils.Job[int])
		typeId := job.Payload

		timeToWait := job.Time - time.Now().Unix()
		if timeToWait > 0 {
			if !ordersUpToDate {
				log.Println("Orders worker is up to date !")
				ordersUpToDate = true
			}
			time.Sleep(time.Duration(timeToWait) * time.Second)
		} else if timeToWait < 60*10 && job.Time != 0 {
			log.Printf("Orders worker is late of %ds", -timeToWait)
			ordersUpToDate = false
		}

		// send job to workers
		// if all workers are occupied than ait
		jobs <- typeId

		priorityCreditsMu.RLock()
		credits := priorityCredits[typeId]
		priorityCreditsMu.RUnlock()
		if credits == 0 {
			job.Time = time.Now().Unix() + 60*60
		} else {
			job.Time = time.Now().Unix() + 60*10
		}

		heap.Push(&jobsQueue, job)
	}
}

func HandleOrdersRequest(w http.ResponseWriter, r *http.Request) {
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

	priorityCreditsMu.Lock()
	oldPrio := priorityCredits[typeId]
	priorityCredits[typeId] = orderPriorityBonus
	priorityCreditsMu.Unlock()
	if oldPrio == 0 {
		log.Printf("Added type %d to hight priority list", typeId)
	}

	fileName := getOrdersFileName(typeId, regionId)
	if !diskStorage.Exist(fileName) {
		http.Error(w, "Internal Server Error", 500)
		return
	}

	cacheFile := diskStorage.GetFile(fileName)
	diskStorage.Serve(w, r, cacheFile)
}

func getOrders(typeId int, regionId int) ([]Order, error) {
	orders := make([]Order, 0, 1000)
	fileName := getOrdersFileName(typeId, regionId)
	file, err := diskStorage.Read(fileName)
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(file, &orders)
	if err != nil {
		return nil, err
	}
	return orders, nil
}

func setOrders(typeId int, regions []int) error {
	ordersByRegion := make(map[int][]Order)
	ordersByRegion[0] = make([]Order, 0, 1000)

	for _, regionId := range regions {
		uri := fmt.Sprintf("/markets/%d/orders", regionId)
		query := map[string]string{
			"type_id":    strconv.Itoa(typeId),
			"order_type": "all",
		}

		page := 1
		for {
			query["page"] = strconv.Itoa(page)
			orders, err := esi.EsiFetch[[]Order](uri, "GET", query, nil)
			if err != nil {
				esiError, ok := err.(*esi.EsiError)
				if ok && esiError.Code == 404 {
					break
				}
				return err
			}

			ordersByRegion[0] = append(ordersByRegion[0], orders...)
			ordersByRegion[regionId] = append(ordersByRegion[regionId], orders...)

			if len(orders) != 1000 {
				break
			}
		}
	}

	for region, orders := range ordersByRegion {
		jsonData, err := json.Marshal(orders)
		if err != nil {
			return err
		}

		fileName := getOrdersFileName(typeId, region)
		err = diskStorage.Write(fileName, jsonData)
		if err != nil {
			return err
		}
	}

	return nil
}

// region 0 commespond to all regions
func getOrdersFileName(typeId int, regionId int) string {
	if regionId == 0 {
		return fmt.Sprintf("orders-all/%d.json", typeId)
	} else {
		return fmt.Sprintf("orders-%d/%d.json", regionId, typeId)
	}
}
