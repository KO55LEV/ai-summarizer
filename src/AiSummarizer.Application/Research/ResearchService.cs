using System.Text.Json;
using AiSummarizer.Application.Users;

namespace AiSummarizer.Application.Research;

public sealed class ResearchService(IResearchRepository repository, IUsersRepository usersRepository) : IResearchService
{
    public async Task<ResearchListDto> GetResearchListAsync(Guid? requestedByUserId, int limit, int offset, CancellationToken cancellationToken)
    {
        var topics = await repository.ListTopicsAsync(requestedByUserId, limit, offset, cancellationToken);
        var stats = await repository.GetStatsAsync(requestedByUserId, cancellationToken);
        return new ResearchListDto(topics, stats);
    }

    public async Task<ResearchTopicDto> GetTopicAsync(Guid topicId, CancellationToken cancellationToken)
        => await repository.GetTopicByIdAsync(topicId, cancellationToken)
            ?? throw new ResearchNotFoundException("Research topic not found.");

    public async Task<ResearchTopicDto> CreateTopicAsync(CreateResearchTopicCommand command, CancellationToken cancellationToken)
    {
        var requestedByUserId = RequireRequestedByUserId(command.RequestedByUserId);
        await EnsureUserExistsAsync(requestedByUserId, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var topicId = await repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            var id = await txRepository.CreateTopicAsync(new ResearchTopicRecord(
                Guid.NewGuid(),
                requestedByUserId,
                command.ProjectId,
                command.Name.Trim(),
                NormalizeNullable(command.Description),
                NormalizeKey(command.Frequency),
                NormalizeStatus(command.Status),
                command.DeliveryTime,
                null,
                NormalizeStatus(command.Status) == "active"
                    ? CalculateNextRunAt(NormalizeKey(command.Frequency), now, command.DeliveryTime)
                    : null,
                null,
                now,
                now), tx, cancellationToken);

            await txRepository.ReplaceTopicSourcesAsync(id, NormalizeList(command.Sources), tx, cancellationToken);
            await txRepository.ReplaceTopicTagsAsync(id, NormalizeList(command.Tags), tx, cancellationToken);
            await txRepository.ReplaceTopicOutputsAsync(id, NormalizeList(command.Outputs), tx, cancellationToken);
            return id;
        }, cancellationToken);

        return await GetTopicAsync(topicId, cancellationToken);
    }

    public async Task<ResearchTopicDto> UpdateTopicAsync(Guid topicId, UpdateResearchTopicCommand command, CancellationToken cancellationToken)
    {
        var existing = await GetTopicAsync(topicId, cancellationToken);
        var nextFrequency = NormalizeKey(command.Frequency);
        var nextStatus = NormalizeStatus(command.Status);
        var nextRunAt = CalculateUpdatedNextRunAt(existing, nextFrequency, nextStatus, command.DeliveryTime);

        await repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            await txRepository.UpdateTopicAsync(new ResearchTopicRecord(
                existing.Id,
                existing.RequestedByUserId,
                command.ProjectId ?? existing.ProjectId,
                command.Name.Trim(),
                NormalizeNullable(command.Description),
                nextFrequency,
                nextStatus,
                command.DeliveryTime,
                existing.LastRunAt,
                nextRunAt,
                existing.LastBriefingPreview,
                existing.CreatedAt,
                DateTimeOffset.UtcNow), tx, cancellationToken);

            await txRepository.ReplaceTopicSourcesAsync(existing.Id, NormalizeList(command.Sources), tx, cancellationToken);
            await txRepository.ReplaceTopicTagsAsync(existing.Id, NormalizeList(command.Tags), tx, cancellationToken);
            await txRepository.ReplaceTopicOutputsAsync(existing.Id, NormalizeList(command.Outputs), tx, cancellationToken);
            return 0;
        }, cancellationToken);

        return await GetTopicAsync(topicId, cancellationToken);
    }

    public async Task DeleteTopicAsync(Guid topicId, CancellationToken cancellationToken)
    {
        await repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            await txRepository.DeleteTopicAsync(topicId, tx, cancellationToken);
            return 0;
        }, cancellationToken);
    }

    public async Task<ResearchBriefingDto> GetLatestBriefingAsync(Guid topicId, CancellationToken cancellationToken)
        => await repository.GetLatestBriefingAsync(topicId, cancellationToken)
            ?? throw new ResearchNotFoundException("Research briefing not found.");

    public async Task<ResearchBriefingDto> GetBriefingAsync(Guid topicId, Guid briefingId, CancellationToken cancellationToken)
    {
        var briefing = await repository.GetBriefingByIdAsync(briefingId, cancellationToken)
            ?? throw new ResearchNotFoundException("Research briefing not found.");

        if (briefing.ResearchTopicId != topicId)
        {
            throw new ResearchNotFoundException("Research briefing not found for this topic.");
        }

        return briefing;
    }

    public async Task<IReadOnlyList<ResearchBriefingHistoryItemDto>> ListBriefingHistoryAsync(Guid topicId, int limit, int offset, CancellationToken cancellationToken)
        => await repository.ListBriefingHistoryAsync(topicId, limit, offset, cancellationToken);

    public async Task<ResearchBriefingDto> CreateBriefingAsync(Guid topicId, CreateResearchBriefingCommand command, CancellationToken cancellationToken)
    {
        var topic = await GetTopicAsync(topicId, cancellationToken);
        var requestedByUserId = command.RequestedByUserId ?? topic.RequestedByUserId;
        if (requestedByUserId is not null)
        {
            await EnsureUserExistsAsync(requestedByUserId.Value, cancellationToken);
        }

        var generatedAt = command.GeneratedAt;
        var nextRunAt = command.NextRunAt ?? CalculateNextRunAt(topic.Frequency, generatedAt, topic.DeliveryTime);
        var now = DateTimeOffset.UtcNow;

        var briefingId = await repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            var version = (await txRepository.GetBriefingCountAsync(topicId, cancellationToken)) + 1;
            var id = await txRepository.CreateBriefingAsync(new ResearchBriefingRecord(
                Guid.NewGuid(),
                topicId,
                requestedByUserId,
                version,
                generatedAt,
                command.PeriodLabel.Trim(),
                command.ReadTimeMinutes,
                command.WordCount,
                command.Summary.Trim(),
                command.PreviewText.Trim(),
                now,
                now), tx, cancellationToken);

            await txRepository.ReplaceBriefingSectionsAsync(id, command.Sections, tx, cancellationToken);
            await txRepository.ReplaceBriefingSourcesAsync(id, command.Sources, tx, cancellationToken);
            await txRepository.UpdateTopicBriefingStateAsync(topicId, generatedAt, nextRunAt, command.PreviewText.Trim(), tx, cancellationToken);
            return id;
        }, cancellationToken);

        return await GetBriefingByIdAsync(briefingId, cancellationToken);
    }

    private async Task<ResearchBriefingDto> GetBriefingByIdAsync(Guid briefingId, CancellationToken cancellationToken)
        => await repository.GetBriefingByIdAsync(briefingId, cancellationToken)
            ?? throw new ResearchNotFoundException("Research briefing not found.");

    private async Task EnsureUserExistsAsync(Guid userId, CancellationToken cancellationToken)
    {
        _ = await usersRepository.GetUserByIdAsync(userId, null, cancellationToken)
            ?? throw new ResearchValidationException("RequestedByUserId must reference an existing user.");
    }

    private static Guid RequireRequestedByUserId(Guid? requestedByUserId)
        => requestedByUserId ?? throw new ResearchValidationException("RequestedByUserId is required.");

    private static string NormalizeKey(string value) => value.Trim().ToLowerInvariant();
    private static string NormalizeStatus(string value)
    {
        var status = NormalizeKey(value);
        return status is "active" or "paused" or "draft"
            ? status
            : throw new ResearchValidationException("Research topic status must be draft, active, or paused.");
    }

    private static string? NormalizeNullable(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static IReadOnlyList<string> NormalizeList(IReadOnlyList<string> values)
        => values.Select(NormalizeNullable).Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value!).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

    private static DateTimeOffset? CalculateNextRunAt(string frequency, DateTimeOffset generatedAt, TimeOnly? deliveryTime)
    {
        if (frequency == "hourly")
        {
            var nextHour = generatedAt.UtcDateTime.AddHours(1);
            return new DateTimeOffset(new DateTime(nextHour.Year, nextHour.Month, nextHour.Day, nextHour.Hour, 0, 0, DateTimeKind.Utc), TimeSpan.Zero);
        }

        var next = frequency switch
        {
            "daily" => generatedAt.AddDays(1),
            "weekly" => generatedAt.AddDays(7),
            "monthly" => generatedAt.AddMonths(1),
            _ => generatedAt.AddDays(1)
        };

        if (deliveryTime is null)
        {
            return next;
        }

        var date = next.UtcDateTime.Date;
        return new DateTimeOffset(date.Add(deliveryTime.Value.ToTimeSpan()), TimeSpan.Zero);
    }

    private static DateTimeOffset? CalculateUpdatedNextRunAt(ResearchTopicDto existing, string frequency, string status, TimeOnly? deliveryTime)
    {
        if (status != "active")
        {
            return null;
        }

        if (existing.Status == "active"
            && existing.NextRunAt is not null
            && existing.NextRunAt > DateTimeOffset.UtcNow
            && existing.Frequency == frequency
            && existing.DeliveryTime == deliveryTime)
        {
            return existing.NextRunAt;
        }

        return CalculateNextRunAt(frequency, DateTimeOffset.UtcNow, deliveryTime);
    }
}

public sealed class ResearchValidationException(string message) : Exception(message);
public sealed class ResearchNotFoundException(string message) : Exception(message);
