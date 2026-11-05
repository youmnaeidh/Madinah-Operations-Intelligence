let
    Source = fnReadRepositoryCsv("data/FactIncidents.csv", {
        {"IncidentID", type text},
        {"CreatedAt", type datetime},
        {"DateKey", Int64.Type},
        {"Hour", Int64.Type},
        {"DistrictKey", Int64.Type},
        {"CategoryKey", Int64.Type},
        {"Subcategory", type text},
        {"ChannelKey", Int64.Type},
        {"TeamKey", Int64.Type},
        {"Priority", type text},
        {"Status", type text},
        {"AssignedAt", type datetime},
        {"ResolvedAt", type datetime},
        {"ResponseHours", type number},
        {"ResolutionHours", type number},
        {"SLATargetHours", type number},
        {"SLAMet", type logical},
        {"IsRepeat", type logical},
        {"RepeatGroupID", Int64.Type},
        {"WasReopened", type logical},
        {"SatisfactionScore", type number},
        {"Latitude", type number},
        {"Longitude", type number},
        {"DataClass", type text}
    }),
    // Preserve ResponseHours. Elapsed seconds / 3600, not DATEDIFF hour buckets.
    WithAssignmentDelay = Table.AddColumn(Source, "AssignmentDelayHours", each
        if [CreatedAt] = null or [AssignedAt] = null or [AssignedAt] < [CreatedAt]
        then error "Invalid assignment timestamps"
        else Duration.TotalHours([AssignedAt] - [CreatedAt]), type number)
in
    WithAssignmentDelay
