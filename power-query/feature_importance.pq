let
    Source = fnReadRepositoryCsv("ai-model/feature_importance.csv", {
        {"Feature", type text},
        {"Importance", type number},
        {"ImportanceShare", type number}
    })
in
    Source
