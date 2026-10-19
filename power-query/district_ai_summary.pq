let
    Source = fnReadRepositoryCsv("ai-model/district_ai_summary.csv", {
        {"DistrictKey", Int64.Type},
        {"DistrictEN", type text},
        {"TotalReports", Int64.Type},
        {"AveragePredictedRisk", type number},
        {"HighRiskReports", Int64.Type},
        {"PredictedBreaches", Int64.Type},
        {"ActualBreachRate", type number}
    })
in
    Source
