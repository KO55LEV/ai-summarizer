using System.Text.Json;
using AiSummarizer.Application.Jobs;
using AiSummarizer.Application.Notes;
using AiSummarizer.Application.State;
using AiSummarizer.Domain.Jobs;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Worker;

public sealed class TelegramPollingHostedService(
    TelegramBotApiClient telegramClient,
    IAppStateRepository stateRepository,
    IJobsRepository jobsRepository,
    INotesRepository notesRepository,
    IOptions<TelegramOptions> options,
    ILogger<TelegramPollingHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var telegramOptions = options.Value;
        if (string.IsNullOrWhiteSpace(telegramOptions.BotToken))
        {
            logger.LogInformation("Telegram bot token is missing; Telegram polling is disabled.");
            return;
        }

        var pollDelay = TimeSpan.FromSeconds(Math.Max(1, telegramOptions.PollIntervalSeconds));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var lastUpdateId = await ReadLastUpdateIdAsync(stoppingToken);
                var updates = await telegramClient.GetUpdatesAsync(lastUpdateId + 1, Math.Max(1, telegramOptions.MaxUpdatesPerPoll), stoppingToken);

                if (updates.Count == 0)
                {
                    await Task.Delay(pollDelay, stoppingToken);
                    continue;
                }

                var maxSeenUpdateId = lastUpdateId;
                var allEnqueued = true;
                foreach (var update in updates)
                {
                    var updateId = GetUpdateId(update);
                    if (!TryGetMessage(update, out var message) || !TryGetLong(message, "from", "id", out var telegramUserId))
                    {
                        if (updateId is not null)
                        {
                            maxSeenUpdateId = Math.Max(maxSeenUpdateId, updateId.Value);
                        }
                        continue;
                    }

                    var linkedUserId = await ResolveLinkedUserIdAsync(telegramUserId, stoppingToken);
                    if (linkedUserId is null)
                    {
                        logger.LogDebug("Skipping Telegram update {UpdateId} from unlinked user {TelegramUserId}", updateId ?? -1, telegramUserId);
                        if (updateId is not null)
                        {
                            maxSeenUpdateId = Math.Max(maxSeenUpdateId, updateId.Value);
                        }
                        continue;
                    }

                    try
                    {
                        await jobsRepository.CreateJobAsync(new Job
                        {
                            Id = Guid.NewGuid(),
                            RequestedByUserId = linkedUserId,
                            JobType = "notes.telegram.ingest",
                            Priority = 0,
                            Status = JobStatus.Queued,
                            Payload = update.Clone(),
                            AttemptCount = 0,
                            MaxAttempts = 3,
                            AvailableAt = DateTimeOffset.UtcNow,
                            CreatedAt = DateTimeOffset.UtcNow,
                            UpdatedAt = DateTimeOffset.UtcNow
                        }, stoppingToken);
                    }
                    catch (Exception ex)
                    {
                        allEnqueued = false;
                        logger.LogError(ex, "Failed to enqueue Telegram update {UpdateId}", TryGetLong(update, "update_id", out var failedUpdateId) ? failedUpdateId : -1);
                    }

                    if (updateId is not null)
                    {
                        maxSeenUpdateId = Math.Max(maxSeenUpdateId, updateId.Value);
                    }
                }

                if (allEnqueued && maxSeenUpdateId > lastUpdateId)
                {
                    await WriteLastUpdateIdAsync(maxSeenUpdateId, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Telegram polling iteration failed");
                await Task.Delay(pollDelay, stoppingToken);
            }
        }
    }

    private async Task<long> ReadLastUpdateIdAsync(CancellationToken cancellationToken)
    {
        var state = await stateRepository.GetStateAsync(options.Value.StateKey, cancellationToken);
        if (state is null)
        {
            return 0;
        }

        var stateValue = state.Value;
        if (stateValue.ValueKind != JsonValueKind.Object)
        {
            return 0;
        }

        if (stateValue.TryGetProperty("last_update_id", out var lastUpdateIdProperty) && lastUpdateIdProperty.TryGetInt64(out var lastUpdateId))
        {
            return lastUpdateId;
        }

        return 0;
    }

    private async Task WriteLastUpdateIdAsync(long lastUpdateId, CancellationToken cancellationToken)
    {
        await stateRepository.UpsertStateAsync(options.Value.StateKey, JsonSerializer.SerializeToElement(new { last_update_id = lastUpdateId }), cancellationToken);
    }

    private async Task<Guid?> ResolveLinkedUserIdAsync(long telegramUserId, CancellationToken cancellationToken)
    {
        var telegramAccount = await notesRepository.GetTelegramAccountByTelegramUserIdAsync(telegramUserId, cancellationToken);
        if (telegramAccount is null)
        {
            return null;
        }

        var link = await notesRepository.GetUserTelegramAccountByTelegramAccountIdAsync(telegramAccount.Id, cancellationToken);
        return link?.RequestedByUserId;
    }

    private static bool TryGetMessage(JsonElement update, out JsonElement message)
    {
        message = default;
        return update.ValueKind == JsonValueKind.Object && update.TryGetProperty("message", out message);
    }

    private static bool TryGetLong(JsonElement element, string firstProperty, string secondProperty, out long value)
    {
        value = default;
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(firstProperty, out var nested) || nested.ValueKind != JsonValueKind.Object || !nested.TryGetProperty(secondProperty, out var nestedValue))
        {
            return false;
        }

        return nestedValue.TryGetInt64(out value);
    }

    private static bool TryGetLong(JsonElement element, string propertyName, out long value)
    {
        value = default;
        return element.ValueKind == JsonValueKind.Object && element.TryGetProperty(propertyName, out var property) && property.TryGetInt64(out value);
    }

    private static long? GetUpdateId(JsonElement update)
        => TryGetLong(update, "update_id", out var updateId) ? updateId : null;
}
