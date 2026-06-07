using System.Text.Json;
using AiSummarizer.Application.Emails;
using Microsoft.Extensions.DependencyInjection;

namespace AiSummarizer.Worker.JobsProcessing.Handlers;

public sealed class WelcomeEmailJobHandler(
    IServiceScopeFactory scopeFactory,
    ILogger<WelcomeEmailJobHandler> logger) : IJobHandler
{
    public string JobType => "email.welcome";

    public async Task<JobHandlerResult> HandleAsync(JobExecutionContext context, CancellationToken cancellationToken)
    {
        var payload = ParsePayload(context.Job.Payload);
        if (payload is null)
        {
            return JobHandlerResult.DeadLetter("invalid_payload", "Welcome email job payload is invalid.", null);
        }

        await context.LogInfoAsync(
            "Preparing welcome email",
            JsonSerializer.SerializeToElement(new
            {
                payload.UserId,
                payload.Email,
                payload.DisplayName
            }),
            cancellationToken);

        try
        {
            using var scope = scopeFactory.CreateScope();
            var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
            var emailTemplatesService = scope.ServiceProvider.GetRequiredService<IEmailTemplatesService>();

            var recipientName = string.IsNullOrWhiteSpace(payload.DisplayName)
                ? payload.Email.Trim()
                : payload.DisplayName.Trim();

            EmailMessage message;
            try
            {
                var rendered = await emailTemplatesService.RenderAsync(
                    "email.welcome",
                    new Dictionary<string, string?>
                    {
                        ["displayName"] = recipientName,
                        ["name"] = recipientName,
                        ["email"] = payload.Email.Trim(),
                        ["appName"] = "Ai Summarizer"
                    },
                    cancellationToken);

                message = new EmailMessage(
                    To:
                    [
                        new EmailAddress(payload.Email, recipientName)
                    ],
                    Subject: rendered.Subject,
                    HtmlBody: rendered.HtmlBody,
                    TextBody: rendered.TextBody,
                    Tags:
                    [
                        "welcome",
                        "signup"
                    ]);
            }
            catch (EmailTemplateNotFoundException)
            {
                message = new EmailMessage(
                    To:
                    [
                        new EmailAddress(payload.Email, recipientName)
                    ],
                    Subject: "Welcome to Ai Summarizer",
                    HtmlBody: BuildHtmlBody(recipientName, payload.Email),
                    TextBody: BuildTextBody(recipientName, payload.Email),
                    Tags:
                    [
                        "welcome",
                        "signup"
                    ]);
            }

            var result = await emailSender.SendAsync(message, cancellationToken);
            await context.LogInfoAsync(
                "Welcome email sent",
                JsonSerializer.SerializeToElement(new
                {
                    result.Provider,
                    result.MessageId,
                    payload.Email
                }),
                cancellationToken);

            return JobHandlerResult.Success(JsonSerializer.SerializeToElement(new
            {
                provider = result.Provider,
                messageId = result.MessageId,
                email = payload.Email
            }));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Welcome email job failed for {Email}", payload.Email);

            var details = JsonSerializer.SerializeToElement(new
            {
                exception = ex.GetType().FullName,
                stackTrace = ex.StackTrace,
                payload.Email
            });

            if (context.Job.AttemptCount < context.Job.MaxAttempts)
            {
                return JobHandlerResult.Retry("welcome_email_retryable", ex.Message, details, TimeSpan.FromMinutes(1));
            }

            return JobHandlerResult.DeadLetter("welcome_email_failed", ex.Message, details);
        }
    }

    private static string BuildHtmlBody(string displayName, string email)
    {
        var name = string.IsNullOrWhiteSpace(displayName) ? email : displayName.Trim();
        return $$"""
               <div style="font-family: Inter, Arial, sans-serif; color: #e5eefc; background: #081122; padding: 32px;">
                 <div style="max-width: 640px; margin: 0 auto; background: #0b172b; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 32px;">
                   <h1 style="margin: 0 0 16px; font-size: 28px;">Welcome, {{name}}!</h1>
                   <p style="margin: 0 0 14px; line-height: 1.6;">Your Ai Summarizer account is ready.</p>
                   <p style="margin: 0 0 14px; line-height: 1.6;">You can now organize research, generate summaries, and keep everything in one workspace.</p>
                   <p style="margin: 24px 0 0; line-height: 1.6; color: #8aa0bd;">If you did not create this account, you can ignore this message.</p>
                 </div>
               </div>
               """;
    }

    private static string BuildTextBody(string displayName, string email)
    {
        var name = string.IsNullOrWhiteSpace(displayName) ? email : displayName.Trim();
        return $"Welcome, {name}! Your Ai Summarizer account is ready. If you did not create this account, you can ignore this message.";
    }

    private sealed record WelcomeEmailPayload(Guid UserId, string Email, string? DisplayName);

    private static WelcomeEmailPayload? ParsePayload(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!payload.TryGetProperty("email", out var emailProperty) || emailProperty.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var email = emailProperty.GetString();
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var userId = payload.TryGetProperty("userId", out var userIdProperty) && userIdProperty.ValueKind == JsonValueKind.String && Guid.TryParse(userIdProperty.GetString(), out var parsedUserId)
            ? parsedUserId
            : Guid.Empty;

        string? displayName = null;
        if (payload.TryGetProperty("displayName", out var displayNameProperty) && displayNameProperty.ValueKind == JsonValueKind.String)
        {
            displayName = displayNameProperty.GetString();
        }

        return new WelcomeEmailPayload(userId, email.Trim(), displayName);
    }
}
