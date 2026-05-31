namespace AiSummarizer.Application.MediaSources;

public sealed record MediaSourceIdentity(
    string SourceProvider,
    string SourceKind,
    string ExternalSourceId,
    string CanonicalUrl,
    string OriginalUrl);

public static class MediaSourceIdentityParser
{
    public static MediaSourceIdentity ParseYouTube(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("YouTube URL is required.", nameof(value));
        }

        var trimmed = value.Trim();
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) ||
            (!uri.Scheme.Equals(Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) &&
             !uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)))
        {
            throw new ArgumentException("YouTubeUrl must be an absolute http or https URL.", nameof(value));
        }

        var externalId = TryExtractYouTubeVideoId(uri);
        if (string.IsNullOrWhiteSpace(externalId))
        {
            throw new ArgumentException("Unable to extract a YouTube video id from the supplied URL.", nameof(value));
        }

        return new MediaSourceIdentity(
            "youtube",
            "video",
            externalId,
            $"https://www.youtube.com/watch?v={externalId}",
            trimmed);
    }

    private static string? TryExtractYouTubeVideoId(Uri uri)
    {
        if (uri.Host.Contains("youtu.be", StringComparison.OrdinalIgnoreCase))
        {
            var path = uri.AbsolutePath.Trim('/');
            return string.IsNullOrWhiteSpace(path) ? null : path.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault();
        }

        if (uri.Host.Contains("youtube.com", StringComparison.OrdinalIgnoreCase))
        {
            var path = uri.AbsolutePath.Trim('/');
            if (path.Equals("watch", StringComparison.OrdinalIgnoreCase))
            {
                return GetQueryParameter(uri, "v");
            }

            if (path.StartsWith("shorts/", StringComparison.OrdinalIgnoreCase))
            {
                return path["shorts/".Length..].Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault();
            }

            if (path.StartsWith("embed/", StringComparison.OrdinalIgnoreCase))
            {
                return path["embed/".Length..].Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault();
            }
        }

        return null;
    }

    private static string? GetQueryParameter(Uri uri, string name)
    {
        if (string.IsNullOrWhiteSpace(uri.Query))
        {
            return null;
        }

        var query = uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var item in query)
        {
            var parts = item.Split('=', 2, StringSplitOptions.TrimEntries);
            if (parts.Length == 2 && parts[0].Equals(name, StringComparison.OrdinalIgnoreCase))
            {
                return Uri.UnescapeDataString(parts[1]);
            }
        }

        return null;
    }
}
