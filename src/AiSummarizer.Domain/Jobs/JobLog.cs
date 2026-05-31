using System.Text.Json;

namespace AiSummarizer.Domain.Jobs;

public sealed record JobLog
{
    public Guid Id { get; init; }
    public Guid JobId { get; init; }
    public int? AttemptNo { get; init; }
    public string Level { get; init; } = "info";
    public string Message { get; init; } = string.Empty;
    public JsonElement Context { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
