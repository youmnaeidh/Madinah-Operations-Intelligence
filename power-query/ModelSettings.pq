let
    Json = Json.Document(File.Contents(Text.TrimEnd(RepositoryRoot, {"/", "\"}) & "/ai-model/model_metrics.json")),
    Settings = #table(type table [ModelName=text, DecisionThreshold=number], {{Json[selected_model], Json[decision_threshold]}})
in
    Settings
