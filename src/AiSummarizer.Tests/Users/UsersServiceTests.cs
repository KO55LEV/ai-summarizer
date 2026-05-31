using System.Data.Common;
using AiSummarizer.Application.Users;
using AiSummarizer.Domain.Users;
using Xunit;

namespace AiSummarizer.Tests.Users;

public sealed class UsersServiceTests
{
    [Fact]
    public async Task RegisterAsync_creates_user_identity_and_session()
    {
        var repo = new FakeUsersRepository();
        var passwordHasher = new FakePasswordHasher();
        var refreshTokens = new FakeRefreshTokenService();
        var verifier = new FakeExternalIdentityVerifier();
        var service = CreateService(repo, passwordHasher, refreshTokens, verifier);

        var result = await service.RegisterAsync(new RegisterUserCommand("User@Example.com", "Password123!", "Alice"), CancellationToken.None);

        Assert.Equal("user@example.com", result.User.Email);
        Assert.Equal("Alice", result.User.DisplayName);
        Assert.NotEqual(Guid.Empty, repo.CreatedUsers.Single().Id);
        Assert.Equal("password", repo.CreatedIdentities.Single().Provider.ToString().ToLowerInvariant());
        Assert.Equal("user@example.com", repo.CreatedIdentities.Single().ProviderSubject);
        Assert.Equal("hashed:Password123!", repo.CreatedIdentities.Single().PasswordHash);
        Assert.Equal("refresh-1", result.Session.RefreshToken);
        Assert.Equal(repo.Sessions.Single().Id.ToString(), result.Session.AccessToken);
    }

    [Fact]
    public async Task LoginWithPasswordAsync_uses_existing_password_identity()
    {
        var repo = new FakeUsersRepository();
        var passwordHasher = new FakePasswordHasher();
        var refreshTokens = new FakeRefreshTokenService();
        var verifier = new FakeExternalIdentityVerifier();
        var service = CreateService(repo, passwordHasher, refreshTokens, verifier);

        var user = repo.SeedUser("user@example.com");
        repo.SeedIdentity(new AuthIdentity
        {
            UserId = user.Id,
            Provider = AuthProvider.Password,
            ProviderSubject = "user@example.com",
            ProviderEmail = "user@example.com",
            PasswordHash = passwordHasher.Hash("Password123!"),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        var result = await service.LoginWithPasswordAsync(new LoginWithPasswordCommand("USER@example.com", "Password123!"), CancellationToken.None);

        Assert.Equal(user.Id, repo.LastLoginUserId);
        Assert.Equal("refresh-1", result.Session.RefreshToken);
        Assert.Equal(user.Email, result.User.Email);
    }

    [Fact]
    public async Task RefreshAsync_rotates_refresh_token_and_updates_session()
    {
        var repo = new FakeUsersRepository();
        var passwordHasher = new FakePasswordHasher();
        var refreshTokens = new FakeRefreshTokenService();
        var verifier = new FakeExternalIdentityVerifier();
        var service = CreateService(repo, passwordHasher, refreshTokens, verifier);

        var user = repo.SeedUser("user@example.com");
        var session = repo.SeedSession(user.Id, refreshTokens.Hash("refresh-existing"));

        var result = await service.RefreshAsync(new RefreshSessionCommand("refresh-existing"), CancellationToken.None);

        Assert.Equal(session.Id.ToString(), result.Session.AccessToken);
        Assert.Equal("refresh-1", result.Session.RefreshToken);
        Assert.Equal(refreshTokens.Hash("refresh-1"), repo.Sessions.Single().RefreshTokenHash);
        Assert.NotNull(repo.Sessions.Single().LastUsedAt);
    }

    [Theory]
    [InlineData(AuthProvider.Google, "google-subject", "google@example.com")]
    [InlineData(AuthProvider.Facebook, "facebook-subject", "facebook@example.com")]
    public async Task External_login_creates_user_and_identity(AuthProvider provider, string subject, string email)
    {
        var repo = new FakeUsersRepository();
        var passwordHasher = new FakePasswordHasher();
        var refreshTokens = new FakeRefreshTokenService();
        var verifier = new FakeExternalIdentityVerifier
        {
            Result = new ExternalIdentityProfile(provider, subject, email, "Display Name", "https://avatar", true)
        };
        var service = CreateService(repo, passwordHasher, refreshTokens, verifier);

        var result = provider == AuthProvider.Google
            ? await service.LoginWithGoogleAsync(new ExternalLoginCommand("external-token"), CancellationToken.None)
            : await service.LoginWithFacebookAsync(new ExternalLoginCommand("external-token"), CancellationToken.None);

        Assert.Equal(email, result.User.Email);
        Assert.Equal(subject, repo.CreatedIdentities.Single().ProviderSubject);
        Assert.Equal(provider, repo.CreatedIdentities.Single().Provider);
        Assert.Equal("refresh-1", result.Session.RefreshToken);
    }

    [Fact]
    public async Task Google_login_links_to_existing_password_user_by_verified_email()
    {
        var repo = new FakeUsersRepository();
        var passwordHasher = new FakePasswordHasher();
        var refreshTokens = new FakeRefreshTokenService();
        var verifier = new FakeExternalIdentityVerifier
        {
            Result = new ExternalIdentityProfile(AuthProvider.Google, "google-subject", "user@example.com", "Display Name", "https://avatar", true)
        };
        var service = CreateService(repo, passwordHasher, refreshTokens, verifier);

        var user = repo.SeedUser("user@example.com");
        repo.SeedIdentity(new AuthIdentity
        {
            UserId = user.Id,
            Provider = AuthProvider.Password,
            ProviderSubject = "user@example.com",
            ProviderEmail = "user@example.com",
            PasswordHash = passwordHasher.Hash("Password123!"),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        var result = await service.LoginWithGoogleAsync(new ExternalLoginCommand("external-token"), CancellationToken.None);

        Assert.Equal(user.Id, result.User.Id);
        Assert.Equal(user.Email, result.User.Email);
        Assert.Equal(2, repo.CreatedIdentities.Count);
        Assert.Equal(AuthProvider.Google, repo.CreatedIdentities.Last().Provider);
        Assert.Equal(user.Id, repo.CreatedIdentities.Last().UserId);
    }

    [Fact]
    public async Task Google_login_rejects_unverified_email()
    {
        var repo = new FakeUsersRepository();
        var passwordHasher = new FakePasswordHasher();
        var refreshTokens = new FakeRefreshTokenService();
        var verifier = new FakeExternalIdentityVerifier
        {
            Result = new ExternalIdentityProfile(AuthProvider.Google, "google-subject", "user@example.com", "Display Name", "https://avatar", false)
        };
        var service = CreateService(repo, passwordHasher, refreshTokens, verifier);

        await Assert.ThrowsAsync<UserUnauthorizedException>(() => service.LoginWithGoogleAsync(new ExternalLoginCommand("external-token"), CancellationToken.None));
        Assert.Empty(repo.CreatedUsers);
        Assert.Empty(repo.CreatedIdentities);
    }

    [Fact]
    public async Task LogoutAsync_revokes_session()
    {
        var repo = new FakeUsersRepository();
        var service = CreateService(repo, new FakePasswordHasher(), new FakeRefreshTokenService(), new FakeExternalIdentityVerifier());
        var user = repo.SeedUser("user@example.com");
        var session = repo.SeedSession(user.Id, "hash:refresh-1");

        await service.LogoutAsync(session.Id, CancellationToken.None);

        Assert.NotNull(repo.Sessions.Single().RevokedAt);
        Assert.Equal("logout", repo.Sessions.Single().RevokedReason);
    }

    private static UsersService CreateService(
        FakeUsersRepository repo,
        FakePasswordHasher passwordHasher,
        FakeRefreshTokenService refreshTokens,
        FakeExternalIdentityVerifier verifier)
        => new(
            repo,
            passwordHasher,
            refreshTokens,
            verifier,
            new UsersOptions
            {
                SessionLifetimeDays = 30,
                RefreshTokenLifetimeDays = 30
            });

    private sealed class FakeUsersRepository : IUsersRepository
    {
        private readonly List<User> _users = new();
        private readonly List<AuthIdentity> _identities = new();
        private readonly List<Session> _sessions = new();

        public IReadOnlyList<User> CreatedUsers => _users;
        public IReadOnlyList<AuthIdentity> CreatedIdentities => _identities;
        public IReadOnlyList<Session> Sessions => _sessions;
        public Guid? LastLoginUserId { get; private set; }

        public T Exec<T>(Func<IUsersRepository, DbTransaction, Task<T>> action)
            => action(this, null!).GetAwaiter().GetResult();

        public Task<T> ExecuteInTransactionAsync<T>(Func<IUsersRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken)
            => Task.FromResult(Exec(action));

        public Task<User?> GetUserByIdAsync(Guid userId, DbTransaction? transaction, CancellationToken cancellationToken)
            => Task.FromResult(_users.SingleOrDefault(x => x.Id == userId));

        public Task<User?> GetUserByEmailAsync(string email, DbTransaction? transaction, CancellationToken cancellationToken)
            => Task.FromResult(_users.SingleOrDefault(x => string.Equals(x.Email, email, StringComparison.OrdinalIgnoreCase)));

        public Task<AuthIdentity?> GetAuthIdentityByProviderSubjectAsync(AuthProvider provider, string providerSubject, DbTransaction? transaction, CancellationToken cancellationToken)
            => Task.FromResult(_identities.SingleOrDefault(x => x.Provider == provider && x.ProviderSubject == providerSubject));

        public Task<Session?> GetSessionByIdAsync(Guid sessionId, DbTransaction? transaction, CancellationToken cancellationToken)
            => Task.FromResult(_sessions.SingleOrDefault(x => x.Id == sessionId));

        public Task<Session?> GetSessionByRefreshTokenHashAsync(string refreshTokenHash, DbTransaction? transaction, CancellationToken cancellationToken)
            => Task.FromResult(_sessions.SingleOrDefault(x => x.RefreshTokenHash == refreshTokenHash));

        public Task<User> CreateUserAsync(User user, DbTransaction? transaction, CancellationToken cancellationToken)
        {
            var created = user with { Id = Guid.NewGuid(), CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            _users.Add(created);
            return Task.FromResult(created);
        }

        public Task<AuthIdentity> CreateAuthIdentityAsync(AuthIdentity authIdentity, DbTransaction? transaction, CancellationToken cancellationToken)
        {
            var created = authIdentity with { Id = Guid.NewGuid(), CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            _identities.Add(created);
            return Task.FromResult(created);
        }

        public Task<Session> CreateSessionAsync(Session session, DbTransaction? transaction, CancellationToken cancellationToken)
        {
            var created = session with { Id = Guid.NewGuid(), CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            _sessions.Add(created);
            return Task.FromResult(created);
        }

        public Task UpdateUserLastLoginAsync(Guid userId, DateTimeOffset lastLoginAt, DbTransaction? transaction, CancellationToken cancellationToken)
        {
            LastLoginUserId = userId;
            var index = _users.FindIndex(x => x.Id == userId);
            if (index >= 0)
            {
                _users[index] = _users[index] with { LastLoginAt = lastLoginAt };
            }
            return Task.CompletedTask;
        }

        public Task UpdateAuthIdentityLastUsedAsync(Guid authIdentityId, DateTimeOffset lastUsedAt, DbTransaction? transaction, CancellationToken cancellationToken)
        {
            var index = _identities.FindIndex(x => x.Id == authIdentityId);
            if (index >= 0)
            {
                _identities[index] = _identities[index] with { LastUsedAt = lastUsedAt };
            }
            return Task.CompletedTask;
        }

        public Task UpdateSessionRefreshTokenAsync(Guid sessionId, string refreshTokenHash, DateTimeOffset expiresAt, DateTimeOffset updatedAt, DbTransaction? transaction, CancellationToken cancellationToken)
        {
            var index = _sessions.FindIndex(x => x.Id == sessionId);
            if (index >= 0)
            {
                _sessions[index] = _sessions[index] with
                {
                    RefreshTokenHash = refreshTokenHash,
                    ExpiresAt = expiresAt,
                    UpdatedAt = updatedAt
                };
            }
            return Task.CompletedTask;
        }

        public Task UpdateSessionLastUsedAsync(Guid sessionId, DateTimeOffset lastUsedAt, DbTransaction? transaction, CancellationToken cancellationToken)
        {
            var index = _sessions.FindIndex(x => x.Id == sessionId);
            if (index >= 0)
            {
                _sessions[index] = _sessions[index] with { LastUsedAt = lastUsedAt };
            }
            return Task.CompletedTask;
        }

        public Task RevokeSessionAsync(Guid sessionId, string reason, DateTimeOffset revokedAt, DbTransaction? transaction, CancellationToken cancellationToken)
        {
            var index = _sessions.FindIndex(x => x.Id == sessionId);
            if (index >= 0)
            {
                _sessions[index] = _sessions[index] with { RevokedAt = revokedAt, RevokedReason = reason };
            }
            return Task.CompletedTask;
        }

        public User SeedUser(string email)
        {
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = email,
                Status = UserStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _users.Add(user);
            return user;
        }

        public AuthIdentity SeedIdentity(AuthIdentity identity)
        {
            var created = identity with { Id = Guid.NewGuid(), CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            _identities.Add(created);
            return created;
        }

        public Session SeedSession(Guid userId, string refreshTokenHash)
        {
            var session = new Session
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                RefreshTokenHash = refreshTokenHash,
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(30),
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _sessions.Add(session);
            return session;
        }
    }

    private sealed class FakePasswordHasher : ISecurePasswordHasher
    {
        public string Hash(string password) => $"hashed:{password}";

        public bool Verify(string password, string passwordHash) => Hash(password) == passwordHash;
    }

    private sealed class FakeRefreshTokenService : IRefreshTokenService
    {
        private int _sequence = 0;

        public string Generate() => $"refresh-{++_sequence}";

        public string Hash(string refreshToken) => $"hash:{refreshToken}";
    }

    private sealed class FakeExternalIdentityVerifier : IExternalIdentityVerifier
    {
        public ExternalIdentityProfile Result { get; set; } = new(AuthProvider.Google, "subject", "user@example.com", "User", null, true);

        public Task<ExternalIdentityProfile> VerifyAsync(AuthProvider provider, string accessToken, CancellationToken cancellationToken)
            => Task.FromResult(Result with { Provider = provider });
    }
}
