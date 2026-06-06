using System.Net;
using System.IO;
using System.Text;
using System.Text.Json;
using AiSummarizer.Application.Emails;
using AiSummarizer.Application.Settings;
using AiSummarizer.Infrastructure.Email;
using AiSummarizer.Infrastructure.Email.Models;
using Microsoft.Extensions.Options;
using Xunit;

namespace AiSummarizer.Tests.Email;

public sealed class BrevoEmailSenderTests
{
    [Fact]
    public async Task SendAsync_builds_brevo_request_and_returns_message_id()
    {
        var handler = new RecordingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.Accepted)
        {
            Content = new StringContent("""{"messageId":"<message-123>"}""", Encoding.UTF8, "application/json")
        });
        var client = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.brevo.com")
        };
        var sender = new BrevoEmailSender(client, Options.Create(new BrevoEmailOptions
        {
            ApiKey = "brevo-api-key",
            BaseUrl = "https://api.brevo.com"
        }));

        var result = await sender.SendAsync(new EmailMessage(
            To: [new EmailAddress("recipient@example.com", "Recipient")],
            Subject: "Hello",
            HtmlBody: "<p>Hello</p>",
            From: new EmailAddress("sender@example.com", "Sender"),
            ReplyTo: new EmailAddress("reply@example.com", "Reply"),
            Tags: ["welcome"]),
            new EmailRuntimeSettingsDto("Brevo", "no-reply@example.com", "AiSummarizer"),
            CancellationToken.None);

        Assert.Equal("Brevo", result.Provider);
        Assert.Equal("<message-123>", result.MessageId);
        Assert.Equal(HttpMethod.Post, handler.Request!.Method);
        Assert.Equal("/v3/smtp/email", handler.Request.RequestUri!.AbsolutePath);
        Assert.Equal("brevo-api-key", handler.Request.Headers.GetValues("api-key").Single());

        var body = handler.RequestBody!;
        using var document = JsonDocument.Parse(body);
        Assert.Equal("Hello", document.RootElement.GetProperty("subject").GetString());
        Assert.Equal("reply@example.com", document.RootElement.GetProperty("replyTo").GetProperty("email").GetString());
        Assert.Equal("recipient@example.com", document.RootElement.GetProperty("to").EnumerateArray().Single().GetProperty("email").GetString());
        Assert.Equal("<p>Hello</p>", document.RootElement.GetProperty("htmlContent").GetString());
        Assert.Equal("welcome", document.RootElement.GetProperty("tags").EnumerateArray().Single().GetString());
    }

    [Fact]
    public async Task SendAsync_uses_default_sender_when_message_does_not_provide_one()
    {
        var handler = new RecordingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"messageId":"<message-456>"}""", Encoding.UTF8, "application/json")
        });
        var client = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.brevo.com")
        };
        var brevoSender = new BrevoEmailSender(client, Options.Create(new BrevoEmailOptions
        {
            ApiKey = "brevo-api-key",
            BaseUrl = "https://api.brevo.com"
        }));
        var emailSender = new EmailSender(
            brevoSender,
            new FileEmailSender(Options.Create(new EmailFileDumpOptions
            {
                FolderPath = Path.Combine(Path.GetTempPath(), "ai-summarizer-email-tests")
            })),
            new FakeAdminSettingsService("Brevo"));

        var result = await emailSender.SendAsync(new EmailMessage(
            To: [new EmailAddress("recipient@example.com")],
            Subject: "Welcome",
            TextBody: "Welcome aboard"),
            CancellationToken.None);

        Assert.Equal("<message-456>", result.MessageId);

        var body = handler.RequestBody!;
        using var document = JsonDocument.Parse(body);
        Assert.Equal("no-reply@example.com", document.RootElement.GetProperty("sender").GetProperty("email").GetString());
        Assert.Equal("AiSummarizer", document.RootElement.GetProperty("sender").GetProperty("name").GetString());
    }

    [Fact]
    public async Task SendAsync_writes_email_to_file_when_file_provider_is_active()
    {
        var dumpRoot = Path.Combine(Path.GetTempPath(), "ai-summarizer-email-dump-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dumpRoot);

        var emailSender = new EmailSender(
            new BrevoEmailSender(
                new HttpClient(new RecordingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)))
                {
                    BaseAddress = new Uri("https://api.brevo.com")
                },
                Options.Create(new BrevoEmailOptions
                {
                    ApiKey = "brevo-api-key",
                    BaseUrl = "https://api.brevo.com"
                })),
            new FileEmailSender(Options.Create(new EmailFileDumpOptions
            {
                FolderPath = dumpRoot
            })),
            new FakeAdminSettingsService("File"));

        var result = await emailSender.SendAsync(new EmailMessage(
            To: [new EmailAddress("recipient@example.com", "Recipient")],
            Subject: "Dump test",
            HtmlBody: "<p>Dump me</p>"),
            CancellationToken.None);

        Assert.Equal("File", result.Provider);
        Assert.EndsWith(".json", result.MessageId);
        Assert.True(File.Exists(result.MessageId));

        var dumped = await File.ReadAllTextAsync(result.MessageId);
        using var document = JsonDocument.Parse(dumped);
        Assert.Equal("File", document.RootElement.GetProperty("provider").GetString());
        Assert.Equal("Dump test", document.RootElement.GetProperty("email").GetProperty("subject").GetString());
        Assert.Equal("no-reply@example.com", document.RootElement.GetProperty("email").GetProperty("from").GetProperty("email").GetString());
        Assert.Equal("AiSummarizer", document.RootElement.GetProperty("settings").GetProperty("defaultFromName").GetString());
    }

    private sealed class RecordingHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responseFactory) : HttpMessageHandler
    {
        public HttpRequestMessage? Request { get; private set; }
        public string? RequestBody { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Request = request;
            RequestBody = request.Content is null ? null : request.Content.ReadAsStringAsync(cancellationToken).GetAwaiter().GetResult();
            return Task.FromResult(responseFactory(request));
        }
    }

    private sealed class FakeAdminSettingsService(string emailProvider = "Brevo") : IAdminSettingsService
    {
        public Task<AdminSettingsDto> GetAsync(CancellationToken cancellationToken)
            => Task.FromResult(new AdminSettingsDto(
                new EmailRuntimeSettingsDto(emailProvider, "no-reply@example.com", "AiSummarizer"),
                new TranscribeRuntimeSettingsDto("Whisper")));

        public Task<AdminSettingsDto> UpdateAsync(UpdateAdminSettingsCommand command, CancellationToken cancellationToken)
            => throw new NotImplementedException();
    }
}
