package main

import (
	"bytes"
	_ "embed"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"log"
	"strconv"
)

type system struct {
	id       uint64
	regionId uint64
	security float32
	name     string
}

//go:embed data/systems.csv
var csvSystems []byte
var systems []system

func init() {
	var err error
	systems, err = readSystemSvg()
	if err != nil {
		log.Panicf("readSystemSvg: %v", err)
	}
}

func getSystemById(id uint64) (system, error) {
	for i := range systems {
		if systems[i].id == id {
			return systems[i], nil
		}
	}
	return system{}, errors.New("Unknown solar system, You should renew data/systemscsv")
}

func readSystemSvg() ([]system, error) {
	r := csv.NewReader(bytes.NewReader(csvSystems))
	record, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("reader error: %w", err)
	}
	if record[0] != "regionID" || record[1] != "solarSystemID" || record[2] != "solarSystemName" || record[3] != "security" {
		return nil, fmt.Errorf("invalid system csv header %v", record)
	}

	systemSlice := make([]system, 0, 9000)
	for {
		record, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("record read: %w", err)
		}

		regionId, err := strconv.ParseUint(record[0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("regionId in not a valid uint64: %w", err)
		}
		id, err := strconv.ParseUint(record[1], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("id in not a valid uint64: %w", err)
		}
		security, err := strconv.ParseFloat(record[3], 32)
		if err != nil {
			return nil, fmt.Errorf("security in not a valid float32: %w", err)
		}

		systemSlice = append(systemSlice, system{
			id:       id,
			regionId: regionId,
			name:     record[2],
			security: float32(security),
		})
	}

	return systemSlice, nil
}
