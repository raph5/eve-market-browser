package locations

import (
	"context"
	"fmt"

	"github.com/raph5/eve-market-browser/apps/store/lib/esi"
)

type esiStructure struct {
	Name     string `json:"name"`
	SystemId int32  `json:"solar_system_id"`
}

func fetchStrcutreInfo(ctx context.Context, structureId int64) (*esiStructure, error) {
	uri := fmt.Sprintf("/universe/structures/%d", structureId)
	response, err := esi.EsiFetch[esiStructure](ctx, "GET", uri, nil, true, 1, 1)
	if err != nil {
		return nil, fmt.Errorf("fetching esi strucure info: %w", err)
	}
	return response.Data, nil
}
