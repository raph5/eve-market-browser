package esi

import "testing"

func TestBasicAuth(t *testing.T) {
	got := createBasicAuthHeader("CLIENT_ID", "CLIENT_SECRET")
	want := "Q0xJRU5UX0lEOkNMSUVOVF9TRUNSRVQ="
	if got != want {
		t.Errorf("got %v, want %v", got, want)
	}
}
