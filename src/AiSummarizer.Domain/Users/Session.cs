namespace AiSummarizer.Domain.Users;

public sealed record Session
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public Guid? AuthIdentityId { get; init; }
    public string RefreshTokenHash { get; init; } = string.Empty;
    public string? DeviceName { get; init; }
    public string? UserAgent { get; init; }
    public string? IpAddress { get; init; }
    public DateTimeOffset ExpiresAt { get; init; }
    public DateTimeOffset? LastUsedAt { get; init; }
    public DateTimeOffset? RevokedAt { get; init; }
    public string? RevokedReason { get; init; }
    public Guid? ReplacedBySessionId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
