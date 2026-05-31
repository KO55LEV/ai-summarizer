using Microsoft.Extensions.Options;

namespace AiSummarizer.Api.Middleware;

public sealed class InternalApiMiddleware(RequestDelegate next, IOptions<InternalApiOptions> options)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/internal"))
        {
            var configuredKey = options.Value.ApiKey;
            if (string.IsNullOrWhiteSpace(configuredKey))
            {
                throw new InvalidOperationException("Internal API key is not configured.");
            }

            if (!context.Request.Headers.TryGetValue("X-Internal-Api-Key", out var providedKey) || providedKey.Count != 1 || providedKey[0] != configuredKey)
            {
                throw new UnauthorizedAccessException("Invalid internal API credentials.");
            }
        }

        await next(context);
    }
}
