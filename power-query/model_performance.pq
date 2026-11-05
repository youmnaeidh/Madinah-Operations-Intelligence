let
    Source = fnReadRepositoryCsv("ai-model/model_performance.csv", {
        {"Model", type text},
        {"Dataset", type text},
        {"Metric", type text},
        {"Value", type number}
    })
in
    Source
