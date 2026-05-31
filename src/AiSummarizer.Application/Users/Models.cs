using AiSummarizer.Domain.Users;

namespace AiSummarizer.Application.Users;

public sealed record UserDto(
    Guid Id,
    string Email,
    string? DisplayName,
    string? AvatarUrl,
    string? Locale,
    string? TimeZone,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record SessionDto(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset ExpiresAt);

public sealed record AuthResult(
    UserDto User,
    SessionDto Session);

public sealed record RegisterUserCommand(
    string Email,
    string Password,
    string? DisplayName);

public sealed record LoginWithPasswordCommand(
    string Email,
    string Password);

public sealed record ExternalLoginCommand(
    string AccessToken);

public sealed record RefreshSessionCommand(
    string RefreshToken);

public sealed record ExternalIdentityProfile(
    AuthProvider Provider,
    string Subject,
    string? Email,
    string? DisplayName,
    string? AvatarUrl,
    bool EmailVerified);
