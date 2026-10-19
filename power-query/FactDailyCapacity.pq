let
    Source = fnReadRepositoryCsv("data/FactDailyCapacity.csv", {
        {"DateKey", Int64.Type},
        {"DistrictKey", Int64.Type},
        {"Shift", type text},
        {"PlannedTeams", Int64.Type},
        {"AvailableTeams", Int64.Type},
        {"IncidentCapacity", Int64.Type}
    })
in
    Source
