namespace AiSummarizer.Domain.Research;

public sealed class SearchProviderLog
{
    public Guid Id { get; set; }
    public Guid? SearchProviderKeyId { get; set; }
    public Guid? JobId { get; set; }
    public string Provider { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public string RequestPayload { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}
