package locations

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"log"
	"strconv"
	"time"

	"github.com/raph5/eve-market-browser/apps/store/items/systems"
	"github.com/raph5/eve-market-browser/apps/store/items/timerecord"
	"github.com/raph5/eve-market-browser/apps/store/lib/database"
	"github.com/raph5/eve-market-browser/apps/store/lib/esi"
)

type location struct {
	id       int64
	name     string
	systemId int32
	security float32
}

//go:embed data/staStations.csv
var stationCsv []byte

// forbiddenLocations will be reset at each restart
var forbiddenLocations = make(map[int64]struct{})

func Init(ctx context.Context) error {
	count, err := dbGetLocationCount(ctx)
	if err != nil {
		return err
	}
	expiration, err := timerecord.Get(ctx, "LocationExpiration")
	if err != nil {
		return err
	}

	now := time.Now()
	if count == 0 || now.After(expiration) {
		log.Println("Initializing locations")
		err = populateStation(ctx)
		if err != nil {
			return err
		}
		err = timerecord.Set(ctx, "LocationExpiration", expiration.Add(7*24*time.Hour))
		if err != nil {
			return err
		}
		log.Println("Locations initialized")
	}

	return nil
}

func PopulateStructure(ctx context.Context) error {
	unknownIds, err := dbGetUnknownStructures(ctx)
	if err != nil {
		return fmt.Errorf("dbGetUnknownStructures: %w", err)
	}

	var newLocations []location
	for _, id := range unknownIds {
		_, isForbidden := forbiddenLocations[id]
		if isForbidden {
			continue
		}

		info, err := fetchStrcutreInfo(ctx, id)
		var esiError *esi.EsiError
		if errors.As(err, &esiError) {
			forbiddenLocations[id] = struct{}{}
			continue
		}
		if err != nil {
			return err
		}
		system, err := systems.Get(info.SystemId)
		if err != nil {
			return err
		}

		newLocations = append(newLocations, location{
			id:       id,
			name:     info.Name,
			systemId: info.SystemId,
			security: system.Security,
		})
	}

	if len(newLocations) > 0 {
		err = dbAddLocations(ctx, newLocations)
		if err != nil {
			return fmt.Errorf("dbAddLocations: %w", err)
		}
	}

	return nil
}

func populateStation(ctx context.Context) error {
	r := csv.NewReader(bytes.NewReader(stationCsv))
	record, err := r.Read()
	if err != nil {
		return fmt.Errorf("reader error: %w", err)
	}
	if record[0] != "stationID" && record[1] != "security" && record[8] != "solarSystemID" && record[11] != "stationName" {
		return errors.New("invalid station csv header")
	}

	db := ctx.Value("db").(*database.DB)
	timeoutCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()

	tx, err := db.Begin(timeoutCtx)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(timeoutCtx, "DELETE FROM Location")
	if err != nil {
		return err
	}

	stmt, err := tx.PrepareWrite(timeoutCtx, "INSERT INTO Location VALUES (?,?,?,?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for {
		record, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		id, err := strconv.Atoi(record[0])
		if err != nil {
			return err
		}
		systemId, err := strconv.Atoi(record[8])
		if err != nil {
			return err
		}
		name := record[11]
		security, err := strconv.ParseFloat(record[1], 32)
		if err != nil {
			return err
		}

		_, err = stmt.Exec(timeoutCtx, id, systemId, name, security)
		if err != nil {
			return err
		}
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}
