package commodities

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/diskStorage"
)

type MarketGroup struct {
	Id          int    `json:"id"`
	ParentId    *int   `json:"parentId,omitempty"`
	ChildsId    []int  `json:"childsId"`
	Types       []int  `json:"types"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IconFile    string `json:"iconFile"`
	IconAlt     string `json:"iconAlt"`
}

type icon struct {
	file        string
	description string
}

const marketGroupsFile = "marketGroups.json"

var marketGroupsStorageReady = make(chan struct{})

func MarketGroupsWorker() {
	if !diskStorage.Exist(marketGroupsFile) {
		log.Println("Fetching groups")
		err := setGroups()
		if err != nil {
			log.Fatal(err)
		}
		log.Println("Groups ready")
	}

	close(marketGroupsStorageReady)

	for {
		storageTime, _, err := diskStorage.ReadIndex[float64]("marketGroups")
		if err != nil {
			log.Println("Storage index error : " + err.Error())
			continue
		}

		if !diskStorage.Exist(marketGroupsFile) || time.Now().Unix()-int64(storageTime) > int64(24*time.Hour) {
			log.Println("Fetching groups")
			err := setGroups()
			if err != nil {
				log.Println("Market groups update error : " + err.Error())
				continue
			}
			log.Println("Groups ready")
		}

		time.Sleep(30 * time.Minute)
	}
}

func HandleMarketGroupsRequest(w http.ResponseWriter, r *http.Request) {
	<-marketGroupsStorageReady

	cacheFile := diskStorage.GetFile(marketGroupsFile)
	diskStorage.Serve(w, r, cacheFile)
}

func getGroups() ([]MarketGroup, error) {
	marketGroups := make([]MarketGroup, 0, 1000)
	file, err := diskStorage.Read(marketGroupsFile)
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(file, &marketGroups)
	if err != nil {
		return nil, err
	}
	return marketGroups, nil
}

func setGroups() error {
	typeDump, err := http.Get("https://www.fuzzwork.co.uk/dump/latest/invTypes.csv")
	if err != nil {
		return err
	}
	defer typeDump.Body.Close()

	groupDump, err := http.Get("https://www.fuzzwork.co.uk/dump/latest/invMarketGroups.csv")
	if err != nil {
		return err
	}
	defer groupDump.Body.Close()

	iconDump, err := http.Get("https://www.fuzzwork.co.uk/dump/latest/eveIcons.csv")
	if err != nil {
		return err
	}
	defer iconDump.Body.Close()

	if typeDump.StatusCode != 200 || groupDump.StatusCode != 200 || iconDump.StatusCode != 200 {
		return errors.New("one or more fuzzwork responses returned an error code")
	}

	typesReader := csv.NewReader(typeDump.Body)
	typesReader.Read()
	groupsReader := csv.NewReader(groupDump.Body)
	groupsReader.Read()
	iconsReader := csv.NewReader(iconDump.Body)
	iconsReader.Read()

	iconsMap := make(map[int]icon)
	typeNameMap := make(map[int]string)
	groupMap := make(map[int]*MarketGroup)

	for {
		record, err := iconsReader.Read()
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
		path := strings.Split(record[1], "/")
		file := path[len(path)-1]
		description := record[2]

		iconsMap[id] = icon{file: file, description: description}
	}

	for {
		record, err := groupsReader.Read()
		if err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		groupID, err := strconv.Atoi(record[0])
		if err != nil {
			return err
		}
		parentID := record[1]
		groupName := record[2]
		description := record[3]
		iconID, err := strconv.Atoi(record[4])
		if err != nil {
			break
		}

		iconFile := "7_64_15.png"
		iconAlt := "Unknown"

		if icon, ok := iconsMap[iconID]; ok {
			iconFile = icon.file
			iconAlt = icon.description
		}

		groupMap[groupID] = &MarketGroup{
			Id:          groupID,
			ParentId:    nil,
			ChildsId:    []int{},
			Types:       []int{},
			Name:        groupName,
			Description: description,
			IconFile:    iconFile,
			IconAlt:     iconAlt,
		}

		if parentID != "None" {
			pid, err := strconv.Atoi(parentID)
			if err != nil {
				return err
			}
			groupMap[groupID].ParentId = &pid
		}
	}

	for {
		record, err := typesReader.Read()
		if err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		typeID, err := strconv.Atoi(record[0])
		if err != nil {
			return err
		}
		marketGroupID := record[11]
    published := record[10]
		typeName := record[2]

    if published != "1" || marketGroupID == "None" {
      continue
    }

		typeNameMap[typeID] = typeName

    mid, err := strconv.Atoi(marketGroupID)
    if err != nil {
      return err
    }
    if group, ok := groupMap[mid]; ok {
      group.Types = append(group.Types, typeID)
    }
	}

	for groupID, group := range groupMap {
		if group.ParentId != nil {
			if parentGroup, ok := groupMap[*group.ParentId]; ok {
				parentGroup.ChildsId = append(parentGroup.ChildsId, groupID)
			}
		}
	}

	for _, group := range groupMap {
		sort.Slice(group.Types, func(i, j int) bool {
			return typeNameMap[group.Types[i]] < typeNameMap[group.Types[j]]
		})

		sort.Slice(group.ChildsId, func(i, j int) bool {
			return groupMap[group.ChildsId[i]].Name < groupMap[group.ChildsId[j]].Name
		})
	}

	finalData := make([]MarketGroup, 0, len(groupMap))
	for _, group := range groupMap {
		finalData = append(finalData, *group)
	}

	jsonData, err := json.Marshal(finalData)
	if err != nil {
		return err
	}

	err = diskStorage.Write(marketGroupsFile, jsonData)
	if err != nil {
		return err
	}
	err = diskStorage.WriteIndex("marketGroups", time.Now().Unix())
	if err != nil {
		return err
	}

	return nil
}
