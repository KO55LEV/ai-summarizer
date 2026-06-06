using System.Data.Common;
using AiSummarizer.Domain.Users;

namespace AiSummarizer.Application.Users;

public interface IUsersRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<IUsersRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<User?> GetUserByIdAsync(Guid userId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<User?> GetUserByEmailAsync(string email, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<IReadOnlyList<string>> ListRoleKeysByUserIdAsync(Guid userId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<IReadOnlyList<AdminUserDto>> ListAdminUsersAsync(string? search, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<AdminUserDto?> GetAdminUserByIdAsync(Guid userId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<IReadOnlyList<AdminRoleDto>> ListRolesAsync(DbTransaction? transaction, CancellationToken cancellationToken);
    Task<AuthIdentity?> GetAuthIdentityByProviderSubjectAsync(AuthProvider provider, string providerSubject, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Session?> GetSessionByIdAsync(Guid sessionId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Session?> GetSessionByRefreshTokenHashAsync(string refreshTokenHash, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<User> CreateUserAsync(User user, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<AuthIdentity> CreateAuthIdentityAsync(AuthIdentity authIdentity, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Session> CreateSessionAsync(Session session, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateUserProfileAsync(Guid userId, string email, string? displayName, string? avatarUrl, string? locale, string? timeZone, string status, DateTimeOffset updatedAt, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateAuthIdentityEmailsAsync(Guid userId, string email, DateTimeOffset updatedAt, DbTransaction? transaction, CancellationToken cancellationToken);
    Task ReplaceUserRolesAsync(Guid userId, IReadOnlyList<string> roleKeys, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateUserLastLoginAsync(Guid userId, DateTimeOffset lastLoginAt, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateAuthIdentityLastUsedAsync(Guid authIdentityId, DateTimeOffset lastUsedAt, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateSessionRefreshTokenAsync(Guid sessionId, string refreshTokenHash, DateTimeOffset expiresAt, DateTimeOffset updatedAt, DbTransaction? transaction, CancellationToken cancellationToken);
    Task UpdateSessionLastUsedAsync(Guid sessionId, DateTimeOffset lastUsedAt, DbTransaction? transaction, CancellationToken cancellationToken);
    Task RevokeSessionAsync(Guid sessionId, string reason, DateTimeOffset revokedAt, DbTransaction? transaction, CancellationToken cancellationToken);
}

public interface ISecurePasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string passwordHash);
}

public interface IRefreshTokenService
{
    string Generate();
    string Hash(string refreshToken);
}

public interface IExternalIdentityVerifier
{
    Task<ExternalIdentityProfile> VerifyAsync(AuthProvider provider, string accessToken, CancellationToken cancellationToken);
}

public interface IUsersService
{
    Task<AuthResult> RegisterAsync(RegisterUserCommand command, CancellationToken cancellationToken);
    Task<AuthResult> LoginWithPasswordAsync(LoginWithPasswordCommand command, CancellationToken cancellationToken);
    Task<AuthResult> LoginWithGoogleAsync(ExternalLoginCommand command, CancellationToken cancellationToken);
    Task<AuthResult> LoginWithFacebookAsync(ExternalLoginCommand command, CancellationToken cancellationToken);
    Task<AuthResult> RefreshAsync(RefreshSessionCommand command, CancellationToken cancellationToken);
    Task<UserDto> GetMeAsync(Guid sessionId, CancellationToken cancellationToken);
    Task LogoutAsync(Guid sessionId, CancellationToken cancellationToken);
}

public interface IAdminUsersService
{
    Task<IReadOnlyList<AdminUserDto>> ListAsync(string? search, CancellationToken cancellationToken);
    Task<AdminUserDto?> GetAsync(Guid userId, CancellationToken cancellationToken);
    Task<IReadOnlyList<AdminRoleDto>> ListRolesAsync(CancellationToken cancellationToken);
    Task<AdminUserDto> UpdateAsync(Guid userId, UpdateAdminUserCommand command, CancellationToken cancellationToken);
}
