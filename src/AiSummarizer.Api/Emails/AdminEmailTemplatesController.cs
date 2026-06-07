using AiSummarizer.Api.Users;
using AiSummarizer.Application.Emails;
using AiSummarizer.Application.Users;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Emails;

[ApiController]
[Route("api/admin/email-templates")]
public sealed class AdminEmailTemplatesController(IEmailTemplatesService emailTemplatesService, IUsersService usersService) : AdminAccessControllerBase(usersService)
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EmailTemplateResponse>>> List([FromQuery] string? search, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        return Ok((await emailTemplatesService.ListAsync(search, cancellationToken)).Select(Map).ToArray());
    }

    [HttpGet("{templateKey}")]
    public async Task<ActionResult<EmailTemplateResponse>> Get([FromRoute] string templateKey, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        var template = await emailTemplatesService.GetAsync(templateKey, cancellationToken);
        return template is null ? NotFound() : Ok(Map(template));
    }

    [HttpPost]
    public async Task<ActionResult<EmailTemplateResponse>> Create([FromBody] CreateEmailTemplateRequest request, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        return Ok(Map(await emailTemplatesService.CreateAsync(new CreateEmailTemplateCommand(
            request.TemplateKey,
            request.Title,
            request.Description,
            request.Subject,
            request.HtmlBody,
            request.TextBody,
            request.IsActive), cancellationToken)));
    }

    [HttpPut("{templateKey}")]
    public async Task<ActionResult<EmailTemplateResponse>> Update([FromRoute] string templateKey, [FromBody] UpdateEmailTemplateRequest request, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        return Ok(Map(await emailTemplatesService.UpdateAsync(templateKey, new UpdateEmailTemplateCommand(
            request.Title,
            request.Description,
            request.Subject,
            request.HtmlBody,
            request.TextBody,
            request.IsActive), cancellationToken)));
    }

    [HttpDelete("{templateKey}")]
    public async Task<ActionResult> Delete([FromRoute] string templateKey, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        await emailTemplatesService.DeleteAsync(templateKey, cancellationToken);
        return NoContent();
    }

    private static EmailTemplateResponse Map(EmailTemplateDto template)
        => new(
            template.Id,
            template.TemplateKey,
            template.Title,
            template.Description,
            template.Subject,
            template.HtmlBody,
            template.TextBody,
            template.IsActive,
            template.CreatedAt,
            template.UpdatedAt);
}

public sealed record EmailTemplateResponse(
    Guid Id,
    string TemplateKey,
    string Title,
    string? Description,
    string Subject,
    string? HtmlBody,
    string? TextBody,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record CreateEmailTemplateRequest(
    string TemplateKey,
    string Title,
    string? Description,
    string Subject,
    string? HtmlBody,
    string? TextBody,
    bool IsActive);

public sealed record UpdateEmailTemplateRequest(
    string Title,
    string? Description,
    string Subject,
    string? HtmlBody,
    string? TextBody,
    bool IsActive);
