// Date realted utils

package utils

import "time"

func GetDate(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func AssertIsDate(t time.Time) {
	if !GetDate(t).Equal(t) {
		panic("t is not a date")
	}
}
