using AiSummarizer.Application.Users;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Users;

[ApiController]
[Route("api/admin/users")]
public sealed class AdminUsersController(IAdminUsersService adminUsersService, IUsersService usersService) : AdminAccessControllerBase(usersService)
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AdminUserResponse>>> List([FromQuery] string? search, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        return Ok((await adminUsersService.ListAsync(search, cancellationToken)).Select(Map).ToArray());
    }

    [HttpGet("{userId:guid}")]
    public async Task<ActionResult<AdminUserResponse>> Get([FromRoute] Guid userId, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        var user = await adminUsersService.GetAsync(userId, cancellationToken);
        return user is null ? NotFound() : Ok(Map(user));
    }

    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyList<AdminRoleResponse>>> ListRoles(CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        return Ok((await adminUsersService.ListRolesAsync(cancellationToken)).Select(Map).ToArray());
    }

    [HttpPut("{userId:guid}")]
    public async Task<ActionResult<AdminUserResponse>> Update([FromRoute] Guid userId, [FromBody] UpdateAdminUserRequest request, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        return Ok(Map(await adminUsersService.UpdateAsync(userId, new UpdateAdminUserCommand(
            request.Email,
            request.DisplayName,
            request.AvatarUrl,
            request.Locale,
            request.TimeZone,
            request.Status,
            request.Roles), cancellationToken)));
    }

    private static AdminUserResponse Map(AdminUserDto user)
        => new(
            user.Id,
            user.Email,
            user.DisplayName,
            user.AvatarUrl,
            user.Locale,
            user.TimeZone,
            user.Status,
            user.Roles,
            user.SessionCount,
            user.LastLoginAt,
            user.EmailVerifiedAt,
            user.CreatedAt,
            user.UpdatedAt);

    private static AdminRoleResponse Map(AdminRoleDto role)
        => new(role.RoleKey, role.DisplayName, role.Description);
}

public sealed record AdminUserResponse(
    Guid Id,
    string Email,
    string? DisplayName,
    string? AvatarUrl,
    string? Locale,
    string? TimeZone,
    string Status,
    IReadOnlyList<string> Roles,
    int SessionCount,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset? EmailVerifiedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record AdminRoleResponse(
    string RoleKey,
    string DisplayName,
    string? Description);

public sealed record UpdateAdminUserRequest(
    string Email,
    string? DisplayName,
    string? AvatarUrl,
    string? Locale,
    string? TimeZone,
    string Status,
    IReadOnlyList<string> Roles);
