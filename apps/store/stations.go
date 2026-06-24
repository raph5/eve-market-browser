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

type station struct {
	id       uint64
	regionId uint64
	name     string
}

//go:embed data/stations.csv
var csvStations []byte
var regionToNpcStationSlice map[uint64][]uint64
var stationMap map[uint64]station

func init() {
	var err error
	regionToNpcStationSlice, stationMap, err = readStationCsv()
	if err != nil {
		log.Panicf("readStationCsv: %v", err)
	}
}

func getSqlNpcStationIdListForRegion(regionId uint64) string {
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

func readStationCsv() (map[uint64][]uint64, map[uint64]station, error) {
	r := csv.NewReader(bytes.NewReader(csvStations))
	record, err := r.Read()
	if err != nil {
		return nil, nil, fmt.Errorf("reader error: %w", err)
	}
	if record[0] != "npcStationID" || record[1] != "npcStationName" || record[2] != "regionID" {
		return nil, nil, fmt.Errorf("invalid system csv header %v", record)
	}

	_regionToNpcStationSlice := make(map[uint64][]uint64)
	_stationMap := make(map[uint64]station)
	for {
		record, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, nil, fmt.Errorf("record read: %w", err)
		}

		npcStationId, err := strconv.ParseUint(record[0], 10, 64)
		if err != nil {
			return nil, nil, fmt.Errorf("npcStationId in not a valid uint64: %w", err)
		}
		npcStationName := record[1]
		regionId, err := strconv.ParseUint(record[2], 10, 64)
		if err != nil {
			return nil, nil, fmt.Errorf("regionId in not a valid uint64: %w", err)
		}

		_regionToNpcStationSlice[regionId] = append(_regionToNpcStationSlice[regionId], npcStationId)
		_stationMap[npcStationId] = station{
			id: npcStationId,
			regionId: regionId,
			name: npcStationName,
		}
	}

	return _regionToNpcStationSlice, _stationMap, nil
}
