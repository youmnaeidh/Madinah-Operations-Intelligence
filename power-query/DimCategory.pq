let
    Source = fnReadRepositoryCsv("data/DimCategory.csv", {
        {"CategoryKey", Int64.Type},
        {"CategoryEN", type text},
        {"CategoryAR", type text},
        {"BaseShare", type number},
        {"SLATargetHours", type number},
        {"Complexity", type number}
    })
in
    Source
