using System.Data.Common;
using AiSummarizer.Application.Users;
using AiSummarizer.Domain.Users;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;

namespace AiSummarizer.Infrastructure.Users;

public sealed class UsersRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : IUsersRepository
{
    public async Task<T> ExecuteInTransactionAsync<T>(Func<IUsersRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        var scopedRepository = new UsersRepository(dataSource, sqlScriptLoader, connection, (NpgsqlTransaction)transaction);
        try
        {
            var result = await action(scopedRepository, transaction);
            await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private readonly NpgsqlConnection? _connection = null;
    private readonly NpgsqlTransaction? _transaction = null;

    private UsersRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader, NpgsqlConnection connection, NpgsqlTransaction transaction)
        : this(dataSource, sqlScriptLoader)
    {
        _connection = connection;
        _transaction = transaction;
    }

    public Task<User?> GetUserByIdAsync(Guid userId, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync<User>("Users/GetUserById.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("user_id", userId);
        }, transaction, cancellationToken);

    public Task<User?> GetUserByEmailAsync(string email, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync<User>("Users/GetUserByEmail.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("email", email);
        }, transaction, cancellationToken);

    public Task<AuthIdentity?> GetAuthIdentityByProviderSubjectAsync(AuthProvider provider, string providerSubject, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync<AuthIdentity>("Users/GetAuthIdentityByProviderSubject.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("provider", ToProvider(provider));
            cmd.Parameters.AddWithValue("provider_subject", providerSubject);
        }, transaction, cancellationToken);

    public Task<Session?> GetSessionByIdAsync(Guid sessionId, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync<Session>("Users/GetSessionById.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("session_id", sessionId);
        }, transaction, cancellationToken);

    public Task<Session?> GetSessionByRefreshTokenHashAsync(string refreshTokenHash, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync<Session>("Users/GetSessionByRefreshTokenHash.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("refresh_token_hash", refreshTokenHash);
        }, transaction, cancellationToken);

    public Task<User> CreateUserAsync(User user, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync<User>("Users/CreateUser.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("email", user.Email);
            cmd.Parameters.AddWithValue("display_name", (object?)user.DisplayName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("avatar_url", (object?)user.AvatarUrl ?? DBNull.Value);
            cmd.Parameters.AddWithValue("locale", (object?)user.Locale ?? DBNull.Value);
            cmd.Parameters.AddWithValue("time_zone", (object?)user.TimeZone ?? DBNull.Value);
            cmd.Parameters.AddWithValue("status", ToStatus(user.Status));
            cmd.Parameters.AddWithValue("email_verified_at", (object?)user.EmailVerifiedAt?.UtcDateTime ?? DBNull.Value);
            cmd.Parameters.AddWithValue("last_login_at", (object?)user.LastLoginAt?.UtcDateTime ?? DBNull.Value);
            cmd.Parameters.AddWithValue("deleted_at", (object?)user.DeletedAt?.UtcDateTime ?? DBNull.Value);
        }, transaction, cancellationToken);

    public Task<AuthIdentity> CreateAuthIdentityAsync(AuthIdentity authIdentity, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync<AuthIdentity>("Users/CreateAuthIdentity.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("user_id", authIdentity.UserId);
            cmd.Parameters.AddWithValue("provider", ToProvider(authIdentity.Provider));
            cmd.Parameters.AddWithValue("provider_subject", authIdentity.ProviderSubject);
            cmd.Parameters.AddWithValue("provider_email", (object?)authIdentity.ProviderEmail ?? DBNull.Value);
            cmd.Parameters.AddWithValue("password_hash", (object?)authIdentity.PasswordHash ?? DBNull.Value);
            cmd.Parameters.AddWithValue("last_used_at", (object?)authIdentity.LastUsedAt?.UtcDateTime ?? DBNull.Value);
        }, transaction, cancellationToken);

    public Task<Session> CreateSessionAsync(Session session, DbTransaction? transaction, CancellationToken cancellationToken)
        => QuerySingleAsync<Session>("Users/CreateSession.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("user_id", session.UserId);
            cmd.Parameters.AddWithValue("auth_identity_id", (object?)session.AuthIdentityId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("refresh_token_hash", session.RefreshTokenHash);
            cmd.Parameters.AddWithValue("device_name", (object?)session.DeviceName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("user_agent", (object?)session.UserAgent ?? DBNull.Value);
            cmd.Parameters.AddWithValue("ip_address", (object?)session.IpAddress ?? DBNull.Value);
            cmd.Parameters.AddWithValue("expires_at", session.ExpiresAt.UtcDateTime);
            cmd.Parameters.AddWithValue("last_used_at", (object?)session.LastUsedAt?.UtcDateTime ?? DBNull.Value);
            cmd.Parameters.AddWithValue("revoked_at", (object?)session.RevokedAt?.UtcDateTime ?? DBNull.Value);
            cmd.Parameters.AddWithValue("revoked_reason", (object?)session.RevokedReason ?? DBNull.Value);
            cmd.Parameters.AddWithValue("replaced_by_session_id", (object?)session.ReplacedBySessionId ?? DBNull.Value);
        }, transaction, cancellationToken);

    public Task UpdateUserLastLoginAsync(Guid userId, DateTimeOffset lastLoginAt, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Users/UpdateUserLastLogin.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("user_id", userId);
            cmd.Parameters.AddWithValue("last_login_at", lastLoginAt.UtcDateTime);
        }, transaction, cancellationToken);

    public Task UpdateAuthIdentityLastUsedAsync(Guid authIdentityId, DateTimeOffset lastUsedAt, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Users/UpdateAuthIdentityLastUsed.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("auth_identity_id", authIdentityId);
            cmd.Parameters.AddWithValue("last_used_at", lastUsedAt.UtcDateTime);
        }, transaction, cancellationToken);

    public Task UpdateSessionRefreshTokenAsync(Guid sessionId, string refreshTokenHash, DateTimeOffset expiresAt, DateTimeOffset updatedAt, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Users/UpdateSessionRefreshToken.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("session_id", sessionId);
            cmd.Parameters.AddWithValue("refresh_token_hash", refreshTokenHash);
            cmd.Parameters.AddWithValue("expires_at", expiresAt.UtcDateTime);
            cmd.Parameters.AddWithValue("updated_at", updatedAt.UtcDateTime);
        }, transaction, cancellationToken);

    public Task UpdateSessionLastUsedAsync(Guid sessionId, DateTimeOffset lastUsedAt, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Users/UpdateSessionLastUsed.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("session_id", sessionId);
            cmd.Parameters.AddWithValue("last_used_at", lastUsedAt.UtcDateTime);
        }, transaction, cancellationToken);

    public Task RevokeSessionAsync(Guid sessionId, string reason, DateTimeOffset revokedAt, DbTransaction? transaction, CancellationToken cancellationToken)
        => ExecuteNonQueryAsync("Users/RevokeSession.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("session_id", sessionId);
            cmd.Parameters.AddWithValue("reason", reason);
            cmd.Parameters.AddWithValue("revoked_at", revokedAt.UtcDateTime);
        }, transaction, cancellationToken);

    private async Task<T?> QuerySingleOrDefaultAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken) where T : class
    {
        if (transaction is null)
        {
            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
            configure(command);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return null;
            }

            return Map<T>(reader);
        }

        await using var scopedCommand = CreateCommand(sqlPath, transaction);
        configure(scopedCommand);
        await using var scopedReader = await scopedCommand.ExecuteReaderAsync(cancellationToken);
        if (!await scopedReader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return Map<T>(scopedReader);
    }

    private async Task<T> QuerySingleAsync<T>(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken) where T : class
    {
        var value = await QuerySingleOrDefaultAsync<T>(sqlPath, configure, transaction, cancellationToken);
        return value ?? throw new InvalidOperationException($"No rows returned for {sqlPath}.");
    }

    private async Task ExecuteNonQueryAsync(string sqlPath, Action<NpgsqlCommand> configure, DbTransaction? transaction, CancellationToken cancellationToken)
    {
        if (transaction is null)
        {
            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);
            return;
        }

        await using var scopedCommand = CreateCommand(sqlPath, transaction);
        configure(scopedCommand);
        await scopedCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private NpgsqlCommand CreateCommand(string sqlPath, DbTransaction? transaction)
    {
        var sql = sqlScriptLoader.Load(sqlPath);
        if (transaction is not null)
        {
            var npgsqlTransaction = (NpgsqlTransaction)transaction;
            return new NpgsqlCommand(sql, npgsqlTransaction.Connection!, npgsqlTransaction);
        }

        if (_connection is not null && _transaction is not null)
        {
            return new NpgsqlCommand(sql, _connection, _transaction);
        }

        throw new InvalidOperationException("A transaction-aware repository cannot execute without a transaction.");
    }

    private static string ToProvider(AuthProvider provider) => provider.ToString().ToLowerInvariant();
    private static string ToStatus(UserStatus status) => status.ToString().ToLowerInvariant();

    private static T Map<T>(NpgsqlDataReader reader) where T : class
        => typeof(T).Name switch
        {
            nameof(User) => (MapUser(reader) as T)!,
            nameof(AuthIdentity) => (MapAuthIdentity(reader) as T)!,
            nameof(Session) => (MapSession(reader) as T)!,
            _ => throw new NotSupportedException(typeof(T).Name)
        };

    private static User MapUser(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            Email = reader.GetString(reader.GetOrdinal("email")),
            DisplayName = reader.IsDBNull(reader.GetOrdinal("display_name")) ? null : reader.GetString(reader.GetOrdinal("display_name")),
            AvatarUrl = reader.IsDBNull(reader.GetOrdinal("avatar_url")) ? null : reader.GetString(reader.GetOrdinal("avatar_url")),
            Locale = reader.IsDBNull(reader.GetOrdinal("locale")) ? null : reader.GetString(reader.GetOrdinal("locale")),
            TimeZone = reader.IsDBNull(reader.GetOrdinal("time_zone")) ? null : reader.GetString(reader.GetOrdinal("time_zone")),
            Status = Enum.Parse<UserStatus>(reader.GetString(reader.GetOrdinal("status")), true),
            EmailVerifiedAt = reader.IsDBNull(reader.GetOrdinal("email_verified_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("email_verified_at")),
            LastLoginAt = reader.IsDBNull(reader.GetOrdinal("last_login_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("last_login_at")),
            DeletedAt = reader.IsDBNull(reader.GetOrdinal("deleted_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("deleted_at")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static AuthIdentity MapAuthIdentity(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            UserId = reader.GetGuid(reader.GetOrdinal("user_id")),
            Provider = Enum.Parse<AuthProvider>(reader.GetString(reader.GetOrdinal("provider")), true),
            ProviderSubject = reader.GetString(reader.GetOrdinal("provider_subject")),
            ProviderEmail = reader.IsDBNull(reader.GetOrdinal("provider_email")) ? null : reader.GetString(reader.GetOrdinal("provider_email")),
            PasswordHash = reader.IsDBNull(reader.GetOrdinal("password_hash")) ? null : reader.GetString(reader.GetOrdinal("password_hash")),
            LastUsedAt = reader.IsDBNull(reader.GetOrdinal("last_used_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("last_used_at")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };

    private static Session MapSession(NpgsqlDataReader reader)
        => new()
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            UserId = reader.GetGuid(reader.GetOrdinal("user_id")),
            AuthIdentityId = reader.IsDBNull(reader.GetOrdinal("auth_identity_id")) ? null : reader.GetGuid(reader.GetOrdinal("auth_identity_id")),
            RefreshTokenHash = reader.GetString(reader.GetOrdinal("refresh_token_hash")),
            DeviceName = reader.IsDBNull(reader.GetOrdinal("device_name")) ? null : reader.GetString(reader.GetOrdinal("device_name")),
            UserAgent = reader.IsDBNull(reader.GetOrdinal("user_agent")) ? null : reader.GetString(reader.GetOrdinal("user_agent")),
            IpAddress = reader.IsDBNull(reader.GetOrdinal("ip_address")) ? null : reader.GetString(reader.GetOrdinal("ip_address")),
            ExpiresAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("expires_at")),
            LastUsedAt = reader.IsDBNull(reader.GetOrdinal("last_used_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("last_used_at")),
            RevokedAt = reader.IsDBNull(reader.GetOrdinal("revoked_at")) ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("revoked_at")),
            RevokedReason = reader.IsDBNull(reader.GetOrdinal("revoked_reason")) ? null : reader.GetString(reader.GetOrdinal("revoked_reason")),
            ReplacedBySessionId = reader.IsDBNull(reader.GetOrdinal("replaced_by_session_id")) ? null : reader.GetGuid(reader.GetOrdinal("replaced_by_session_id")),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at"))
        };
}
