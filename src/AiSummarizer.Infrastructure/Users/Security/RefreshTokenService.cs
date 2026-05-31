using System.Security.Cryptography;
using System.Text;
using AiSummarizer.Application.Users;

namespace AiSummarizer.Infrastructure.Users.Security;

public sealed class RefreshTokenService : IRefreshTokenService
{
    public string Generate()
    {
        var bytes = RandomNumberGenerator.GetBytes(48);
        return Base64UrlEncode(bytes);
    }

    public string Hash(string refreshToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string Base64UrlEncode(byte[] bytes)
        => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
