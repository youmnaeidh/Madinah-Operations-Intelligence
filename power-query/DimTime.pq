let
    Source = fnReadRepositoryCsv("data/DimTime.csv", {
        {"Hour", Int64.Type},
        {"TimeBand", type text},
        {"Shift", type text}
    })
in
    Source
