namespace AiSummarizer.Domain.Research;

public sealed class SearchProviderKey
{
    public Guid Id { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public int QuotaPerMonth { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Note { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
