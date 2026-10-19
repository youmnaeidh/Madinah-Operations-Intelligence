let
    Source = fnReadRepositoryCsv("data/DimTeam.csv", {
        {"TeamKey", Int64.Type},
        {"CategoryKey", Int64.Type},
        {"TeamCode", type text},
        {"PrimaryShift", type text},
        {"NominalDailyCapacity", Int64.Type}
    })
in
    Source
