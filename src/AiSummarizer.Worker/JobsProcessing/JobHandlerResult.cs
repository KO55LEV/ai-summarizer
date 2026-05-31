using System.Text.Json;

namespace AiSummarizer.Worker.JobsProcessing;

public sealed record JobHandlerResult(
    JsonElement? Result,
    bool IsDeadLetter,
    string? ErrorCode,
    string? ErrorMessage,
    JsonElement? ErrorDetails,
    TimeSpan RetryDelay)
{
    public static JobHandlerResult Success(JsonElement? result) => new(result, false, null, null, null, TimeSpan.Zero);

    public static JobHandlerResult Retry(string errorCode, string errorMessage, JsonElement? errorDetails, TimeSpan retryDelay)
        => new(null, false, errorCode, errorMessage, errorDetails, retryDelay);

    public static JobHandlerResult DeadLetter(string errorCode, string errorMessage, JsonElement? errorDetails)
        => new(null, true, errorCode, errorMessage, errorDetails, TimeSpan.Zero);
}
