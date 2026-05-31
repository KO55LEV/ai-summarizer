using AiSummarizer.Application.Users;
using Microsoft.AspNetCore.Identity;

namespace AiSummarizer.Infrastructure.Users.Security;

public sealed class PasswordHasherAdapter : ISecurePasswordHasher
{
    private readonly PasswordHasher<object> _hasher = new();

    public string Hash(string password) => _hasher.HashPassword(null!, password);

    public bool Verify(string password, string passwordHash)
        => _hasher.VerifyHashedPassword(null!, passwordHash, password) == PasswordVerificationResult.Success;
}
