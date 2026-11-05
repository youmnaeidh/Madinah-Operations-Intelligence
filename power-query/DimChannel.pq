let
    Source = fnReadRepositoryCsv("data/DimChannel.csv", {
        {"ChannelKey", Int64.Type},
        {"Channel", type text}
    })
in
    Source
