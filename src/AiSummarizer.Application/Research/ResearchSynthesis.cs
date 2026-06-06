namespace AiSummarizer.Application.Research;

public enum ResearchSynthesisRunStatus
{
    Queued = 1,
    Running = 2,
    Succeeded = 3,
    Failed = 4
}

public sealed record ResearchSynthesisRunDto(
    Guid Id,
    Guid ResearchTopicRunId,
    Guid ResearchTopicRunPhaseId,
    Guid ResearchTopicId,
    Guid ResearchRankingRunId,
    ResearchSynthesisRunStatus Status,
    string ReasoningProvider,
    string Model,
    string PromptVersion,
    string InputHash,
    string? RequestJson,
    string? ResponseJson,
    string? OutputJson,
    string? UsageJson,
    int SelectedDocumentCount,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    string? ErrorCode,
    string? ErrorMessage,
    Guid? ResearchBriefingId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchSynthesisRunRecord(
    Guid Id,
    Guid ResearchTopicRunId,
    Guid ResearchTopicRunPhaseId,
    Guid ResearchTopicId,
    Guid ResearchRankingRunId,
    ResearchSynthesisRunStatus Status,
    string ReasoningProvider,
    string Model,
    string PromptVersion,
    string InputHash,
    string? RequestJson,
    string? ResponseJson,
    string? OutputJson,
    string? UsageJson,
    int SelectedDocumentCount,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    string? ErrorCode,
    string? ErrorMessage,
    Guid? ResearchBriefingId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchSynthesisSection(
    string Title,
    string Sentiment,
    IReadOnlyList<string> Items);

public sealed record ResearchSynthesisSource(
    string Title,
    string Domain);

public sealed record ResearchSynthesisOutput(
    string PeriodLabel,
    int ReadTimeMinutes,
    int WordCount,
    string Summary,
    string PreviewText,
    IReadOnlyList<ResearchSynthesisSection> Sections,
    IReadOnlyList<ResearchSynthesisSource> Sources);
