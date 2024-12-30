package histories

var testEsiHistory = []esiHistoryDay{
  {
    Average: 6018000,
    Date: "2024-12-25",
    Highest: 6144000,
    Lowest: 6000000,
    OrderCount: 1739,
    Volume: 833459,
  },
  {
    Average: 6003000,
    Date: "2024-12-27",
    Highest: 6165000,
    Lowest: 6000000,
    OrderCount: 2517,
    Volume: 871308,
  },
  {
    Average: 6000000,
    Date: "2024-12-28",
    Highest: 6008000,
    Lowest: 5997000,
    OrderCount: 2877,
    Volume: 931539,
  },
}

var testDbHistory = []dbHistoryDay{
  {
    Average: 6018000,
    Average5d: 6018000,
    Average20d: 6018000,
    Date: "2024-12-25",
    Highest: 6144000,
    Lowest: 6000000,
    OrderCount: 1739,
    Volume: 833459,
    DonchianTop: 6144000,
    DonchianBottom: 6000000,
  },
  {
    Average: 6018000,
    Average5d: 6018000,
    Average20d: 6018000,
    Date: "2024-12-26",
    Highest: 6018000,
    Lowest: 6018000,
    OrderCount: 1739,
    Volume: 0,
    DonchianTop: 6144000,
    DonchianBottom: 6000000,
  },
  {
    Average: 6003000,
    Average5d: 6015500,
    Average20d: 6017285.714285715,
    Date: "2024-12-27",
    Highest: 6165000,
    Lowest: 6000000,
    OrderCount: 2517,
    Volume: 871308,
    DonchianTop: 6165000,
    DonchianBottom: 6000000,
  },
  {
    Average: 6000000,
    Average5d: 6012500,
    Average20d: 6016428.571428572,
    Date: "2024-12-28",
    Highest: 6008000,
    Lowest: 5997000,
    OrderCount: 2877,
    Volume: 931539,
    DonchianTop: 6165000,
    DonchianBottom: 5997000,
  },
}

func TestEsiToDbHistory() {
  
}
