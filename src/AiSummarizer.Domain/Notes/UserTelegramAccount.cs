namespace AiSummarizer.Domain.Notes;

public sealed record UserTelegramAccount
{
    public Guid Id { get; init; }
    public Guid RequestedByUserId { get; init; }
    public Guid TelegramAccountId { get; init; }
    public DateTimeOffset LinkedAt { get; init; }
    public DateTimeOffset? RevokedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
