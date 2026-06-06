using System.Text.Json;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker;

public sealed class TelegramBotApiClient(
    IHttpClientFactory httpClientFactory,
    IOptions<TelegramOptions> options)
{
    public async Task<IReadOnlyList<JsonElement>> GetUpdatesAsync(long offset, int limit, CancellationToken cancellationToken)
    {
        var response = await SendAsync(
            HttpMethod.Get,
            $"bot{RequireBotToken()}/getUpdates?offset={offset}&limit={limit}",
            null,
            cancellationToken);

        using var document = JsonDocument.Parse(response);
        EnsureOk(document.RootElement, response);

        var result = document.RootElement.GetProperty("result");
        var updates = new List<JsonElement>();
        foreach (var item in result.EnumerateArray())
        {
            updates.Add(item.Clone());
        }

        return updates;
    }

    public async Task<string> GetFilePathAsync(string fileId, CancellationToken cancellationToken)
    {
        var response = await SendAsync(
            HttpMethod.Get,
            $"bot{RequireBotToken()}/getFile?file_id={Uri.EscapeDataString(fileId)}",
            null,
            cancellationToken);

        using var document = JsonDocument.Parse(response);
        EnsureOk(document.RootElement, response);
        var result = document.RootElement.GetProperty("result");
        return result.GetProperty("file_path").GetString() ?? throw new InvalidOperationException("Telegram file_path was missing.");
    }

    public async Task DownloadFileAsync(string filePath, Stream destination, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient();
        client.Timeout = Timeout.InfiniteTimeSpan;

        var downloadUrl = new Uri(NormalizeBaseUrl(options.Value.ApiBaseUrl), $"file/bot{RequireBotToken()}/{filePath.TrimStart('/')}");
        using var response = await client.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Telegram file download failed: {(int)response.StatusCode} {response.ReasonPhrase}: {body}");
        }

        await using var source = await response.Content.ReadAsStreamAsync(cancellationToken);
        await source.CopyToAsync(destination, cancellationToken);
    }

    private async Task<string> SendAsync(HttpMethod method, string relativePath, HttpContent? content, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient();
        client.Timeout = Timeout.InfiniteTimeSpan;

        var request = new HttpRequestMessage(method, new Uri(NormalizeBaseUrl(options.Value.ApiBaseUrl), relativePath))
        {
            Content = content
        };

        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Telegram API returned {(int)response.StatusCode} {response.ReasonPhrase}: {body}");
        }

        return body;
    }

    private static void EnsureOk(JsonElement root, string rawBody)
    {
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("ok", out var okProperty) || !okProperty.GetBoolean())
        {
            throw new InvalidOperationException($"Telegram API response was not ok: {rawBody}");
        }
    }

    private string RequireBotToken()
        => string.IsNullOrWhiteSpace(options.Value.BotToken)
            ? throw new InvalidOperationException("Telegram bot token is missing.")
            : options.Value.BotToken.Trim();

    private static Uri NormalizeBaseUrl(string baseUrl)
    {
        var normalized = baseUrl.Trim();
        if (!normalized.EndsWith('/'))
        {
            normalized += "/";
        }

        return new Uri(normalized, UriKind.Absolute);
    }
}
