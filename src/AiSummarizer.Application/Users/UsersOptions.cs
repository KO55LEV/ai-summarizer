namespace AiSummarizer.Application.Users;

public sealed class UsersOptions
{
    public int SessionLifetimeDays { get; set; } = 30;
    public int RefreshTokenLifetimeDays { get; set; } = 30;
    public string GoogleTokenInfoEndpoint { get; set; } = "https://oauth2.googleapis.com/tokeninfo";
    public string FacebookGraphBaseUrl { get; set; } = "https://graph.facebook.com";
    public string FacebookGraphVersion { get; set; } = "v20.0";
    public string? FacebookAppId { get; set; }
    public string? FacebookAppSecret { get; set; }
}
