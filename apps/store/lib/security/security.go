package security

func ContainsXssPayload(s string) bool {
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '<', '>', '"', '\'':
			return true
		}
	}
	return false
}
