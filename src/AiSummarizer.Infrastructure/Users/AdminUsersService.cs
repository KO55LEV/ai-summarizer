using AiSummarizer.Application.Users;
using AiSummarizer.Domain.Users;

namespace AiSummarizer.Infrastructure.Users;

public sealed class AdminUsersService(IUsersRepository repository) : IAdminUsersService
{
    public Task<IReadOnlyList<AdminUserDto>> ListAsync(string? search, CancellationToken cancellationToken)
        => repository.ListAdminUsersAsync(search, null, cancellationToken);

    public Task<AdminUserDto?> GetAsync(Guid userId, CancellationToken cancellationToken)
        => repository.GetAdminUserByIdAsync(userId, null, cancellationToken);

    public Task<IReadOnlyList<AdminRoleDto>> ListRolesAsync(CancellationToken cancellationToken)
        => repository.ListRolesAsync(null, cancellationToken);

    public async Task<AdminUserDto> UpdateAsync(Guid userId, UpdateAdminUserCommand command, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(command.Email);
        var displayName = NormalizeNullable(command.DisplayName);
        var avatarUrl = NormalizeNullable(command.AvatarUrl);
        var locale = NormalizeNullable(command.Locale);
        var timeZone = NormalizeNullable(command.TimeZone);
        var status = NormalizeStatus(command.Status);
        var roles = command.Roles.Select(NormalizeRoleKey).Where(role => role.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

        return await repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            _ = await txRepository.GetAdminUserByIdAsync(userId, tx, cancellationToken)
                ?? throw new UserNotFoundException("User not found.");

            var existing = await txRepository.GetUserByEmailAsync(email, tx, cancellationToken);
            if (existing is not null && existing.Id != userId)
            {
                throw new UserConflictException("A user with this email already exists.");
            }

            await txRepository.UpdateUserProfileAsync(userId, email, displayName, avatarUrl, locale, timeZone, status, DateTimeOffset.UtcNow, tx, cancellationToken);
            await txRepository.UpdateAuthIdentityEmailsAsync(userId, email, DateTimeOffset.UtcNow, tx, cancellationToken);
            await txRepository.ReplaceUserRolesAsync(userId, roles, tx, cancellationToken);

            return await txRepository.GetAdminUserByIdAsync(userId, tx, cancellationToken)
                ?? throw new UserNotFoundException("User not found after update.");
        }, cancellationToken);
    }

    private static string NormalizeEmail(string email)
    {
        var normalized = email.Trim().ToLowerInvariant();
        if (normalized.Length == 0)
        {
            throw new ArgumentException("Email is required.", nameof(email));
        }

        return normalized;
    }
    private static string? NormalizeNullable(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static string NormalizeStatus(string status)
    {
        var normalized = status.Trim().ToLowerInvariant();
        if (normalized is not ("active" or "disabled" or "deleted"))
        {
            throw new ArgumentException("Invalid user status.", nameof(status));
        }

        return normalized;
    }

    private static string NormalizeRoleKey(string roleKey) => roleKey.Trim().ToLowerInvariant();
}
