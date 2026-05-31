using System.Text.Json;
using AiSummarizer.Application.Users;
using AiSummarizer.Domain.Users;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Users.ExternalAuth;

public sealed class FacebookIdentityVerifier(HttpClient httpClient, IOptions<UsersOptions> options)
{
    public async Task<ExternalIdentityProfile> VerifyAsync(string accessToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(options.Value.FacebookAppId) || string.IsNullOrWhiteSpace(options.Value.FacebookAppSecret))
        {
            throw new InvalidOperationException("Facebook app credentials are not configured.");
        }

        var debugUrl = $"{options.Value.FacebookGraphBaseUrl}/{options.Value.FacebookGraphVersion}/debug_token?input_token={Uri.EscapeDataString(accessToken)}&access_token={Uri.EscapeDataString(options.Value.FacebookAppId)}|{Uri.EscapeDataString(options.Value.FacebookAppSecret)}";
        using var debugResponse = await httpClient.GetAsync(debugUrl, cancellationToken);
        debugResponse.EnsureSuccessStatusCode();
        await using (var debugStream = await debugResponse.Content.ReadAsStreamAsync(cancellationToken))
        using (var debugDocument = await JsonDocument.ParseAsync(debugStream, cancellationToken: cancellationToken))
        {
            var data = debugDocument.RootElement.GetProperty("data");
            if (!data.TryGetProperty("is_valid", out var validProperty) || !validProperty.GetBoolean())
            {
                throw new UnauthorizedAccessException("Facebook token is not valid.");
            }
        }

        var meUrl = $"{options.Value.FacebookGraphBaseUrl}/{options.Value.FacebookGraphVersion}/me?fields=id,name,email,picture.type(large)&access_token={Uri.EscapeDataString(accessToken)}";
        using var meResponse = await httpClient.GetAsync(meUrl, cancellationToken);
        meResponse.EnsureSuccessStatusCode();

        await using var stream = await meResponse.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        var root = document.RootElement;
        var subject = root.GetProperty("id").GetString() ?? throw new InvalidOperationException("Facebook token did not include id.");
        var email = root.TryGetProperty("email", out var emailProperty) ? emailProperty.GetString() : null;
        var displayName = root.TryGetProperty("name", out var nameProperty) ? nameProperty.GetString() : null;
        var avatarUrl = root.TryGetProperty("picture", out var pictureProperty) &&
                        pictureProperty.TryGetProperty("data", out var dataProperty) &&
                        dataProperty.TryGetProperty("url", out var urlProperty)
            ? urlProperty.GetString()
            : null;

        return new ExternalIdentityProfile(AuthProvider.Facebook, subject, email, displayName, avatarUrl, true);
    }
}
