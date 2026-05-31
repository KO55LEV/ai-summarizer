namespace AiSummarizer.Domain.Users;

public sealed record AuthIdentity
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public AuthProvider Provider { get; init; }
    public string ProviderSubject { get; init; } = string.Empty;
    public string? ProviderEmail { get; init; }
    public string? PasswordHash { get; init; }
    public DateTimeOffset? LastUsedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
