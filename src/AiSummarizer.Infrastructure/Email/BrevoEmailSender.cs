using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AiSummarizer.Application.Emails;
using AiSummarizer.Infrastructure.Email.Models;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Email;

public sealed class BrevoEmailSender(
    HttpClient httpClient,
    IOptions<BrevoEmailOptions> options,
    IOptions<EmailOptions> emailOptions)
{
    public async Task<EmailSendResult> SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        var apiKey = options.Value.ApiKey.Trim();
        if (apiKey.Length == 0)
        {
            throw new InvalidOperationException("Email:Brevo:ApiKey is required.");
        }

        if (message.To.Count == 0)
        {
            throw new ArgumentException("At least one recipient is required.", nameof(message));
        }

        if (message.HtmlBody is null && message.TextBody is null)
        {
            throw new ArgumentException("An email body is required.", nameof(message));
        }

        var sender = ResolveSender(message);
        var payload = new BrevoSendEmailRequest(
            Sender: new BrevoEmailAddress(sender.Email, sender.Name),
            To: message.To.Select(recipient => new BrevoEmailAddress(recipient.Email, recipient.Name)).ToArray(),
            Subject: message.Subject,
            HtmlContent: message.HtmlBody,
            TextContent: message.HtmlBody is null ? message.TextBody : null,
            ReplyTo: message.ReplyTo is null ? null : new BrevoEmailAddress(message.ReplyTo.Email, message.ReplyTo.Name),
            Tags: message.Tags?.ToArray());

        using var request = new HttpRequestMessage(HttpMethod.Post, "/v3/smtp/email")
        {
            Content = JsonContent.Create(payload, options: BrevoJsonOptions.Instance)
        };
        request.Headers.Accept.ParseAdd("application/json");
        request.Headers.Add("api-key", apiKey);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new EmailSendException("Brevo", (int)response.StatusCode, responseBody);
        }

        var result = JsonSerializer.Deserialize<BrevoSendEmailResponse>(responseBody, BrevoJsonOptions.Instance);
        if (result?.MessageId is null or "")
        {
            throw new EmailSendException("Brevo", (int)response.StatusCode, "Brevo returned an empty messageId.");
        }

        return new EmailSendResult("Brevo", result.MessageId);
    }

    private EmailAddress ResolveSender(EmailMessage message)
    {
        if (message.From is not null)
        {
            if (string.IsNullOrWhiteSpace(message.From.Email))
            {
                throw new InvalidOperationException("The message sender email is required.");
            }

            return message.From;
        }

        var defaultFromEmail = emailOptions.Value.DefaultFromEmail.Trim();
        if (defaultFromEmail.Length == 0)
        {
            throw new InvalidOperationException("Email:DefaultFromEmail is required when the message does not provide a sender.");
        }

        return new EmailAddress(
            defaultFromEmail,
            emailOptions.Value.DefaultFromName);
    }

    private sealed record BrevoSendEmailResponse(
        [property: JsonPropertyName("messageId")] string MessageId);

    private sealed record BrevoSendEmailRequest(
        [property: JsonPropertyName("sender")] BrevoEmailAddress Sender,
        [property: JsonPropertyName("to")] IReadOnlyList<BrevoEmailAddress> To,
        [property: JsonPropertyName("subject")] string Subject,
        [property: JsonPropertyName("htmlContent")] string? HtmlContent,
        [property: JsonPropertyName("textContent")] string? TextContent,
        [property: JsonPropertyName("replyTo")] BrevoEmailAddress? ReplyTo,
        [property: JsonPropertyName("tags")] IReadOnlyList<string>? Tags);

    private sealed record BrevoEmailAddress(
        [property: JsonPropertyName("email")] string Email,
        [property: JsonPropertyName("name")] string? Name);

    private static class BrevoJsonOptions
    {
        public static readonly JsonSerializerOptions Instance = new(JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
    }
}
