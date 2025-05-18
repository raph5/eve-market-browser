package systems

import (
	"bytes"
	_ "embed"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
)

type System struct {
	Name     string
	Id       int32
	Security float32
}

var ErrNoSystem = errors.New("system not available")

//go:embed data/mapSolarSystems.csv
var systemCsv []byte

// the systemMap weigh around that 400kb so we can load that in memory on startup
var systemMap = make(map[int32]System)

func Init() error {
	r := csv.NewReader(bytes.NewReader(systemCsv))
	record, err := r.Read()
	if err != nil {
		return fmt.Errorf("reader error: %w", err)
	}
	if record[2] != "solarSystemID" && record[3] != "solarSystemName" && record[21] != "security" {
		return errors.New("invalid station csv header")
	}

	for {
		record, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		id, err := strconv.Atoi(record[2])
		if err != nil {
			return err
		}
		if id < 0 || id > math.MaxInt32 {
			return fmt.Errorf("id %d out of range", id)
		}
		name := record[3]
		security, err := strconv.ParseFloat(record[8], 32)
		if err != nil {
			return err
		}

		systemMap[int32(id)] = System{Id: int32(id), Name: name, Security: float32(security)}
	}

	return nil
}

func Get(id int32) (System, error) {
	if id < 0 || id > math.MaxInt32 {
		return System{}, fmt.Errorf("id %d out of range", id)
	}
	s, ok := systemMap[id]
	if !ok {
		return System{}, fmt.Errorf("system %d: %w", id, ErrNoSystem)
	}
	return s, nil
}
