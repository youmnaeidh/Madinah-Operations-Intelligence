// RepositoryRoot is the only machine-specific parameter. No web credentials needed.
(relativePath as text, columnTypes as list) as table =>
let
    Root = Text.TrimEnd(RepositoryRoot, {"/", "\"}),
    Path = Root & "/" & relativePath,
    Csv = Csv.Document(File.Contents(Path), [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
    Headers = Table.PromoteHeaders(Csv, [PromoteAllScalars=true]),
    Typed = Table.TransformColumnTypes(Headers, columnTypes, "en-US")
in
    Typed
