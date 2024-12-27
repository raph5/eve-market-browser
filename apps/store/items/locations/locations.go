package locations

import (
	"context"
	"fmt"

	"github.com/raph5/eve-market-browser/apps/store/lib/esi"
)

type nameAndId struct {
	Id   int    `json:"id"`
	Name string `json:"name"`
}

func Populate(ctx context.Context) error {
  unknownLocations, err := dbGetUnknownLocations(ctx)
  if err != nil {
    return fmt.Errorf("get unknown locations: %w", err)
  }

	locationsData := make([]nameAndId, 0)
	for i := 0; i < len(unknownLocations); i += 1000 {
		chunk := unknownLocations[i:min(i+1000, len(unknownLocations))]
		locationsDataChunk, err := esi.EsiFetch[[]nameAndId](ctx, "POST", "/universe/names", chunk, 1, 5)
		if err != nil {
			return fmt.Errorf("esi request: %w", err)
		}
		locationsData = append(locationsData, *locationsDataChunk...)
	}

  err = dbAddLocations(ctx, locationsData)
  if err != nil {
    return fmt.Errorf("add locations: %w", err)
  }

	return nil
}
