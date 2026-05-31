using System.Text.Json;
using AiSummarizer.Application.Users;
using AiSummarizer.Domain.Users;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Users.ExternalAuth;

public sealed class GoogleIdentityVerifier(HttpClient httpClient, IOptions<UsersOptions> options)
{
    public async Task<ExternalIdentityProfile> VerifyAsync(string accessToken, CancellationToken cancellationToken)
    {
        var endpoint = options.Value.GoogleTokenInfoEndpoint;
        var url = $"{endpoint}?id_token={Uri.EscapeDataString(accessToken)}";
        using var response = await httpClient.GetAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        var root = document.RootElement;
        var subject = root.GetProperty("sub").GetString() ?? throw new InvalidOperationException("Google token did not include sub.");
        var email = root.TryGetProperty("email", out var emailProperty) ? emailProperty.GetString() : null;
        var displayName = root.TryGetProperty("name", out var nameProperty) ? nameProperty.GetString() : null;
        var avatarUrl = root.TryGetProperty("picture", out var pictureProperty) ? pictureProperty.GetString() : null;
        var emailVerified = root.TryGetProperty("email_verified", out var verifiedProperty) &&
                            ((verifiedProperty.ValueKind == JsonValueKind.True) ||
                             (verifiedProperty.ValueKind == JsonValueKind.String && bool.TryParse(verifiedProperty.GetString(), out var parsed) && parsed));

        return new ExternalIdentityProfile(AuthProvider.Google, subject, email, displayName, avatarUrl, emailVerified);
    }
}
