namespace AiSummarizer.Domain.Users;

public sealed record User
{
    public Guid Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string? DisplayName { get; init; }
    public string? AvatarUrl { get; init; }
    public string? Locale { get; init; }
    public string? TimeZone { get; init; }
    public UserStatus Status { get; init; } = UserStatus.Active;
    public DateTimeOffset? EmailVerifiedAt { get; init; }
    public DateTimeOffset? LastLoginAt { get; init; }
    public DateTimeOffset? DeletedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
