// This struct definitions are separated in a separate module so that they can
// be access by the metrics module

package shared

type DbOrder struct {
	Duration     int
	IsBuyOrder   bool
	Issued       string
	LocationId   int
	MinVolume    int
	OrderId      int
	Price        float64
	Range        string
	RegionId     int
	SystemId     int
	TypeId       int
	VolumeRemain int
	VolumeTotal  int
}

type DbHistory struct {
	History  []byte
	TypeId   int
	RegionId int
}

type EsiHistoryDay struct {
	Average    float64 `json:"average"`
	Date       string  `json:"date"`
	Highest    float64 `json:"highest"`
	Lowest     float64 `json:"lowest"`
	OrderCount int     `json:"order_count"`
	Volume     int64   `json:"volume"`
}
