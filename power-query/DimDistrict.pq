let
    Source = fnReadRepositoryCsv("data/DimDistrict.csv", {
        {"DistrictKey", Int64.Type},
        {"DistrictEN", type text},
        {"DistrictAR", type text},
        {"Sector", type text},
        {"CenterLat", type number},
        {"CenterLon", type number},
        {"DemandWeight", type number}
    })
in
    Source
