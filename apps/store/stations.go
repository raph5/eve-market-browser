package main

import (
	"bytes"
	_ "embed"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"strconv"
	"strings"
)

//go:embed data/stations.csv
var csvStations []byte
var regionToNpcStationSlice map[uint64][]uint64

func init() {
	var err error
	regionToNpcStationSlice, err = readStationCsv()
	if err != nil {
		log.Panicf("readStationCsv: %v", err)
	}
}

func getSqlNpcStationListForRegion(regionId uint64) string {
	stationSlice := regionToNpcStationSlice[regionId]

	var b strings.Builder
	for i, v := range stationSlice {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(strconv.FormatUint(v, 10))
	}
	return b.String()
}

func readStationCsv() (map[uint64][]uint64, error) {
	r := csv.NewReader(bytes.NewReader(csvStations))
	record, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("reader error: %w", err)
	}
	if record[0] != "regionID" || record[1] != "npcStationID" {
		return nil, fmt.Errorf("invalid system csv header %v", record)
	}

	_regionToNpcStationSlice := make(map[uint64][]uint64)
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
		npcStationId, err := strconv.ParseUint(record[1], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("npcStationId in not a valid uint64: %w", err)
		}

		_regionToNpcStationSlice[regionId] = append(_regionToNpcStationSlice[regionId], npcStationId)
	}

	return _regionToNpcStationSlice, nil
}
