package commodities

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/diskStorage"
)

type Type struct {
	Id        int    `json:"id"`
	Name      string `json:"name"`
	MetaLevel int    `json:"metaLevel"`
}

const typesFile = "types.json"

var typeStorageReady = make(chan struct{})

func TypesWorker() {
	if !diskStorage.Exist(typesFile) {
		log.Println("Fetching types")
		err := setTypes()
		if err != nil {
			log.Fatal(err)
		}
		log.Println("Types ready")
	}

	close(typeStorageReady)

	for {
		storageTime, _, err := diskStorage.ReadIndex[float64]("types")
		if err != nil {
			log.Fatal("Storage index error : " + err.Error())
		}

		if !diskStorage.Exist(typesFile) || time.Now().Unix()-int64(storageTime) > int64(24*time.Hour) {
			log.Println("Fetching types")
			err := setTypes()
			if err != nil {
				log.Println("Market groups update error : " + err.Error())
				continue
			}
		}

		time.Sleep(30 * time.Minute)
	}
}

func HandleTypesRequest(w http.ResponseWriter, r *http.Request) {
	<-typeStorageReady

	cacheFile := diskStorage.GetFile(typesFile)
	diskStorage.Serve(w, r, cacheFile)
}

func getTypes() ([]Type, error) {
	types := make([]Type, 0, 5000)
	file, err := diskStorage.Read(typesFile)
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(file, &types)
	if err != nil {
		return nil, err
	}
	return types, nil
}

func setTypes() error {
	<-marketGroupsStorageReady
	marketGroups, err := getGroups()
	if err != nil {
		return err
	}

	typeDump, err := http.Get("https://www.fuzzwork.co.uk/dump/latest/invTypes.csv")
	if err != nil {
		return err
	}
	defer typeDump.Body.Close()

	metaTypeDump, err := http.Get("https://www.fuzzwork.co.uk/dump/latest/invMetaTypes.csv")
	if err != nil {
		return err
	}
	defer metaTypeDump.Body.Close()

	if typeDump.StatusCode != 200 || metaTypeDump.StatusCode != 200 {
		return errors.New("one or more fuzzwork responses returned an error code")
	}

	typesReader := csv.NewReader(typeDump.Body)
	typesReader.Read()
	metaTypeReader := csv.NewReader(metaTypeDump.Body)
	metaTypeReader.Read()

	nameMap := make(map[int]string)
	metaLevelMap := make(map[int]int)

	for {
		record, err := typesReader.Read()
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
		name := record[2]

		nameMap[id] = name
	}

	for {
		record, err := metaTypeReader.Read()
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
		metaLevel, err := strconv.Atoi(record[2])
		if err != nil {
			return err
		}

		metaLevelMap[id] = metaLevel
	}

	types := make([]Type, 0, 1000)
	for _, group := range marketGroups {
		for _, t := range group.Types {
			name, ok := nameMap[t]
			if !ok {
				return fmt.Errorf("Can't find name of type %d", t)
			}
			metaLevel, ok := metaLevelMap[t]
			if !ok {
				metaLevel = 1
			}
			types = append(types, Type{Id: t, Name: name, MetaLevel: metaLevel})
		}
	}

	jsonData, err := json.Marshal(types)
	if err != nil {
		return err
	}

	err = diskStorage.Write(typesFile, jsonData)
	if err != nil {
		return err
	}
	err = diskStorage.WriteIndex("types", time.Now().Unix())
	if err != nil {
		return err
	}

	return nil
}
