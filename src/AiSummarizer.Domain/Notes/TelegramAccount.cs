using System.Text.Json;

namespace AiSummarizer.Domain.Notes;

public sealed record TelegramAccount
{
    public Guid Id { get; init; }
    public long TelegramUserId { get; init; }
    public string? Username { get; init; }
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public string? DisplayName { get; init; }
    public string? LanguageCode { get; init; }
    public bool IsBot { get; init; }
    public DateTimeOffset? LastSeenAt { get; init; }
    public JsonElement Metadata { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
