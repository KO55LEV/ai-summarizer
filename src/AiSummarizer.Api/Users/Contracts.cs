namespace AiSummarizer.Api.Users;

public sealed record RegisterUserRequest(string Email, string Password, string? DisplayName);
public sealed record LoginWithPasswordRequest(string Email, string Password);
public sealed record ExternalLoginRequest(string AccessToken);
public sealed record RefreshSessionRequest(string RefreshToken);
public sealed record SessionResponse(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt);
public sealed record UserResponse(
    Guid Id,
    string Email,
    string? DisplayName,
    string? AvatarUrl,
    string? Locale,
    string? TimeZone,
    string Status,
    IReadOnlyList<string> Roles,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
public sealed record AuthResponse(UserResponse User, SessionResponse Session);
