let
    Source = fnReadRepositoryCsv("data/DimDate.csv", {
        {"Date", type datetime},
        {"DateKey", Int64.Type},
        {"Year", Int64.Type},
        {"MonthNo", Int64.Type},
        {"Month", type text},
        {"YearMonth", type text},
        {"DayName", type text},
        {"DayOfWeek", Int64.Type},
        {"IsWeekend", type logical},
        {"Season", type text}
    }),
    DateOnly = Table.TransformColumns(Source, {{"Date", Date.From, type date}})
in
    DateOnly
