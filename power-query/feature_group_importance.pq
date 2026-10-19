let
    Source = fnReadRepositoryCsv("ai-model/feature_group_importance.csv", {
        {"FeatureGroup", type text},
        {"Importance", type number},
        {"ImportanceShare", type number}
    })
in
    Source
