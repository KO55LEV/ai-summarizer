using AiSummarizer.Application.Users;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Users;

public abstract class AdminAccessControllerBase(IUsersService usersService) : ControllerBase
{
    protected async Task<IActionResult?> RequireAdminAsync(CancellationToken cancellationToken)
    {
        var sessionId = ReadSessionId();
        if (sessionId is null)
        {
            return Unauthorized();
        }

        var currentUser = await usersService.GetMeAsync(sessionId.Value, cancellationToken);
        if (!currentUser.Roles.Contains("admin", StringComparer.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        return null;
    }

    private Guid? ReadSessionId()
    {
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return Guid.TryParse(header["Bearer ".Length..].Trim(), out var sessionId) ? sessionId : null;
    }
}
