package locations

import (
	"bytes"
	"encoding/csv"
	"strconv"
	"testing"
)

func TestLoadStationCsv(t *testing.T) {
	r := csv.NewReader(bytes.NewReader(stationCsv))
	record, err := r.Read()
	if err != nil {
		t.Fatal(err)
	}
	t.Log(record)
	if record[0] != "stationID" {
		t.Fatal(err)
	}
	record, err = r.Read()
	if err != nil {
		t.Fatal(err)
	}
	stationId, err := strconv.Atoi(record[0])
	if err != nil {
		t.Fatal(err)
	}
	t.Log(stationId)
}
