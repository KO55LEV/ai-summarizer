using AiSummarizer.Api.Users;
using AiSummarizer.Application.Settings;
using AiSummarizer.Application.Users;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Settings;

[ApiController]
[Route("api/admin/settings")]
public sealed class AdminSettingsController(IAdminSettingsService adminSettingsService, IUsersService usersService) : AdminAccessControllerBase(usersService)
{
    [HttpGet]
    public async Task<ActionResult<AdminSettingsResponse>> Get(CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        return Ok(Map(await adminSettingsService.GetAsync(cancellationToken)));
    }

    [HttpPut]
    public async Task<ActionResult<AdminSettingsResponse>> Update([FromBody] UpdateAdminSettingsRequest request, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        return Ok(Map(await adminSettingsService.UpdateAsync(new UpdateAdminSettingsCommand(
            new UpdateEmailRuntimeSettingsCommand(
                request.Email.Provider,
                request.Email.DefaultFromEmail,
                request.Email.DefaultFromName),
            new UpdateTranscribeRuntimeSettingsCommand(request.Transcribe.Provider)), cancellationToken)));
    }

    private static AdminSettingsResponse Map(AdminSettingsDto settings)
        => new(
            new EmailSettingsResponse(
                settings.Email.Provider,
                settings.Email.DefaultFromEmail,
                settings.Email.DefaultFromName),
            new TranscribeSettingsResponse(settings.Transcribe.Provider));
}
