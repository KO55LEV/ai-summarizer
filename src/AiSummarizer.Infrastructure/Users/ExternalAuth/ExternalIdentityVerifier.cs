using AiSummarizer.Application.Users;
using AiSummarizer.Domain.Users;

namespace AiSummarizer.Infrastructure.Users.ExternalAuth;

public sealed class ExternalIdentityVerifier(
    GoogleIdentityVerifier googleIdentityVerifier,
    FacebookIdentityVerifier facebookIdentityVerifier) : IExternalIdentityVerifier
{
    public Task<ExternalIdentityProfile> VerifyAsync(AuthProvider provider, string accessToken, CancellationToken cancellationToken)
        => provider switch
        {
            AuthProvider.Google => googleIdentityVerifier.VerifyAsync(accessToken, cancellationToken),
            AuthProvider.Facebook => facebookIdentityVerifier.VerifyAsync(accessToken, cancellationToken),
            _ => throw new NotSupportedException($"Provider {provider} is not supported.")
        };
}
