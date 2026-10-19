let
    Source = fnReadRepositoryCsv("ai-model/incident_ai_predictions.csv", {
        {"IncidentID", type text},
        {"CreatedAt", type datetime},
        {"DateKey", Int64.Type},
        {"DistrictKey", Int64.Type},
        {"DistrictEN", type text},
        {"CategoryKey", Int64.Type},
        {"CategoryEN", type text},
        {"ChannelKey", Int64.Type},
        {"Hour", Int64.Type},
        {"Shift", type text},
        {"Priority", type text},
        {"Status", type text},
        {"ActualBreach", Int64.Type},
        {"PredictedBreachProbability", type number},
        {"PredictedBreach", Int64.Type},
        {"RiskBand", type text},
        {"ModelSplit", type text},
        {"ModelName", type text}
    })
in
    Source
