using AiSummarizer.Domain.Users;

namespace AiSummarizer.Application.Users;

public sealed class UsersService(
    IUsersRepository repository,
    ISecurePasswordHasher passwordHasher,
    IRefreshTokenService refreshTokenService,
    IExternalIdentityVerifier externalIdentityVerifier,
    UsersOptions options) : IUsersService
{
    private readonly UsersOptions _options = options;

    public Task<AuthResult> RegisterAsync(RegisterUserCommand command, CancellationToken cancellationToken)
    {
        return repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            var email = NormalizeEmail(command.Email);
            var existing = await txRepository.GetUserByEmailAsync(email, tx, cancellationToken);
            if (existing is not null && existing.DeletedAt is null)
            {
                throw new UserConflictException("A user with this email already exists.");
            }

            var now = DateTimeOffset.UtcNow;
            var user = await txRepository.CreateUserAsync(new User
            {
                Email = email,
                DisplayName = command.DisplayName,
                Status = UserStatus.Active,
                CreatedAt = now,
                UpdatedAt = now
            }, tx, cancellationToken);

            var authIdentity = await txRepository.CreateAuthIdentityAsync(new AuthIdentity
            {
                UserId = user.Id,
                Provider = AuthProvider.Password,
                ProviderSubject = email,
                ProviderEmail = email,
                PasswordHash = passwordHasher.Hash(command.Password),
                CreatedAt = now,
                UpdatedAt = now
            }, tx, cancellationToken);

            return await CreateSessionResultAsync(txRepository, tx, user, authIdentity, now, cancellationToken);
        }, cancellationToken);
    }

    public Task<AuthResult> LoginWithPasswordAsync(LoginWithPasswordCommand command, CancellationToken cancellationToken)
    {
        return repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            var email = NormalizeEmail(command.Email);
            var identity = await txRepository.GetAuthIdentityByProviderSubjectAsync(AuthProvider.Password, email, tx, cancellationToken);
            if (identity is null || string.IsNullOrWhiteSpace(identity.PasswordHash) || !passwordHasher.Verify(command.Password, identity.PasswordHash))
            {
                throw new UserUnauthorizedException("Invalid email or password.");
            }

            var user = await txRepository.GetUserByIdAsync(identity.UserId, tx, cancellationToken)
                ?? throw new UserNotFoundException("User not found.");

            var now = DateTimeOffset.UtcNow;
            await txRepository.UpdateUserLastLoginAsync(user.Id, now, tx, cancellationToken);
            await txRepository.UpdateAuthIdentityLastUsedAsync(identity.Id, now, tx, cancellationToken);

            return await CreateSessionResultAsync(txRepository, tx, user, identity, now, cancellationToken);
        }, cancellationToken);
    }

    public Task<AuthResult> LoginWithGoogleAsync(ExternalLoginCommand command, CancellationToken cancellationToken)
        => LoginWithExternalAsync(AuthProvider.Google, command.AccessToken, cancellationToken);

    public Task<AuthResult> LoginWithFacebookAsync(ExternalLoginCommand command, CancellationToken cancellationToken)
        => LoginWithExternalAsync(AuthProvider.Facebook, command.AccessToken, cancellationToken);

    public Task<AuthResult> RefreshAsync(RefreshSessionCommand command, CancellationToken cancellationToken)
    {
        return repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            var refreshTokenHash = refreshTokenService.Hash(command.RefreshToken);
            var session = await txRepository.GetSessionByRefreshTokenHashAsync(refreshTokenHash, tx, cancellationToken);
            if (session is null || session.RevokedAt is not null || session.ExpiresAt <= DateTimeOffset.UtcNow)
            {
                throw new UserUnauthorizedException("Invalid refresh token.");
            }

            var user = await txRepository.GetUserByIdAsync(session.UserId, tx, cancellationToken)
                ?? throw new UserNotFoundException("User not found.");

            var now = DateTimeOffset.UtcNow;
            var nextRefreshToken = refreshTokenService.Generate();
            await txRepository.UpdateSessionRefreshTokenAsync(
                session.Id,
                refreshTokenService.Hash(nextRefreshToken),
                now.AddDays(_options.RefreshTokenLifetimeDays),
                now,
                tx,
                cancellationToken);
            await txRepository.UpdateSessionLastUsedAsync(session.Id, now, tx, cancellationToken);
            await txRepository.UpdateUserLastLoginAsync(user.Id, now, tx, cancellationToken);

            return new AuthResult(
                MapUser(user),
                new SessionDto(session.Id.ToString(), nextRefreshToken, now.AddDays(_options.SessionLifetimeDays)));
        }, cancellationToken);
    }

    public Task<UserDto> GetMeAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        return repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            var session = await txRepository.GetSessionByIdAsync(sessionId, tx, cancellationToken);
            if (session is null || session.RevokedAt is not null || session.ExpiresAt <= DateTimeOffset.UtcNow)
            {
                throw new UserUnauthorizedException("Session is not active.");
            }

            var user = await txRepository.GetUserByIdAsync(session.UserId, tx, cancellationToken)
                ?? throw new UserNotFoundException("User not found.");

            await txRepository.UpdateSessionLastUsedAsync(session.Id, DateTimeOffset.UtcNow, tx, cancellationToken);
            return MapUser(user);
        }, cancellationToken);
    }

    public async Task LogoutAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        await repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            await txRepository.RevokeSessionAsync(sessionId, "logout", DateTimeOffset.UtcNow, tx, cancellationToken);
            return 0;
        }, cancellationToken);
    }

    private Task<AuthResult> LoginWithExternalAsync(AuthProvider provider, string accessToken, CancellationToken cancellationToken)
    {
        return repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            var profile = await externalIdentityVerifier.VerifyAsync(provider, accessToken, cancellationToken);
            if (string.IsNullOrWhiteSpace(profile.Email))
            {
                throw new UserUnauthorizedException("External account does not provide an email address.");
            }
            var now = DateTimeOffset.UtcNow;
            var normalizedEmail = NormalizeEmail(profile.Email);

            var identity = await txRepository.GetAuthIdentityByProviderSubjectAsync(provider, profile.Subject, tx, cancellationToken);
            User user;
            if (identity is not null)
            {
                user = await txRepository.GetUserByIdAsync(identity.UserId, tx, cancellationToken)
                    ?? throw new UserNotFoundException("User not found.");
            }
            else
            {
                user = await txRepository.GetUserByEmailAsync(normalizedEmail, tx, cancellationToken)
                    ?? await txRepository.CreateUserAsync(new User
                    {
                        Email = normalizedEmail,
                        DisplayName = profile.DisplayName,
                        AvatarUrl = profile.AvatarUrl,
                        Status = UserStatus.Active,
                        EmailVerifiedAt = profile.EmailVerified ? now : null,
                        CreatedAt = now,
                        UpdatedAt = now
                    }, tx, cancellationToken);

                identity = await txRepository.CreateAuthIdentityAsync(new AuthIdentity
                {
                    UserId = user.Id,
                    Provider = provider,
                    ProviderSubject = profile.Subject,
                    ProviderEmail = normalizedEmail,
                    CreatedAt = now,
                    UpdatedAt = now
                }, tx, cancellationToken);
            }

            await txRepository.UpdateUserLastLoginAsync(user.Id, now, tx, cancellationToken);
            await txRepository.UpdateAuthIdentityLastUsedAsync(identity.Id, now, tx, cancellationToken);

            return await CreateSessionResultAsync(txRepository, tx, user, identity, now, cancellationToken);
        }, cancellationToken);
    }

    private async Task<AuthResult> CreateSessionResultAsync(
        IUsersRepository txRepository,
        System.Data.Common.DbTransaction transaction,
        User user,
            AuthIdentity authIdentity,
            DateTimeOffset now,
            CancellationToken cancellationToken)
    {
        var refreshToken = refreshTokenService.Generate();
        var session = await txRepository.CreateSessionAsync(new Session
        {
            UserId = user.Id,
            AuthIdentityId = authIdentity.Id,
            RefreshTokenHash = refreshTokenService.Hash(refreshToken),
            ExpiresAt = now.AddDays(_options.SessionLifetimeDays),
            CreatedAt = now,
            UpdatedAt = now
        }, transaction, cancellationToken);

        return new AuthResult(
            MapUser(user),
            new SessionDto(session.Id.ToString(), refreshToken, session.ExpiresAt));
    }

    private static UserDto MapUser(User user)
        => new(
            user.Id,
            user.Email,
            user.DisplayName,
            user.AvatarUrl,
            user.Locale,
            user.TimeZone,
            user.Status.ToString().ToLowerInvariant(),
            user.CreatedAt,
            user.UpdatedAt);

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
