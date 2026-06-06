using AiSummarizer.Domain.Projects;
using AiSummarizer.Application.Users;

namespace AiSummarizer.Application.Projects;

public sealed class ProjectsService(IProjectsRepository repository, IUsersRepository usersRepository) : IProjectsService
{
    public async Task<ProjectListDto> ListProjectsAsync(Guid? requestedByUserId, int limit, int offset, CancellationToken cancellationToken)
    {
        var projects = await repository.ListProjectsAsync(requestedByUserId, limit, offset, cancellationToken);
        return new ProjectListDto(projects.Select(Map).ToArray());
    }

    public async Task<ProjectDto> GetProjectAsync(Guid projectId, CancellationToken cancellationToken)
        => Map(await repository.GetProjectByIdAsync(projectId, cancellationToken) ?? throw new ProjectNotFoundException("Project not found."));

    public async Task<ProjectDto> CreateProjectAsync(CreateProjectCommand command, CancellationToken cancellationToken)
    {
        var requestedByUserId = RequireRequestedByUserId(command.RequestedByUserId);
        await EnsureUserExistsAsync(requestedByUserId, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var project = await repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            var existingDefault = command.IsDefault
                ? await txRepository.GetDefaultProjectAsync(requestedByUserId, cancellationToken)
                : null;

            if (existingDefault is not null)
            {
                existingDefault = existingDefault with { IsDefault = false, UpdatedAt = now };
                _ = await txRepository.UpdateProjectAsync(existingDefault, tx, cancellationToken);
            }

            return await txRepository.CreateProjectAsync(new Project
            {
                Id = Guid.NewGuid(),
                RequestedByUserId = requestedByUserId,
                Name = NormalizeRequired(command.Name),
                Description = NormalizeNullable(command.Description),
                Aliases = NormalizeAliases(command.Aliases),
                Status = ProjectStatus.Active,
                Color = NormalizeNullable(command.Color),
                Icon = NormalizeNullable(command.Icon),
                IsDefault = command.IsDefault,
                CreatedAt = now,
                UpdatedAt = now
            }, tx, cancellationToken);
        }, cancellationToken);

        return Map(project);
    }

    public async Task<ProjectDto> UpdateProjectAsync(Guid projectId, UpdateProjectCommand command, CancellationToken cancellationToken)
    {
        var existing = await repository.GetProjectByIdAsync(projectId, cancellationToken)
            ?? throw new ProjectNotFoundException("Project not found.");

        var now = DateTimeOffset.UtcNow;
        var requestedByUserId = existing.RequestedByUserId;
        if (requestedByUserId is not null)
        {
            await EnsureUserExistsAsync(requestedByUserId.Value, cancellationToken);
        }

        var project = await repository.ExecuteInTransactionAsync(async (txRepository, tx) =>
        {
            if (command.IsDefault && !existing.IsDefault)
            {
                var otherDefault = await txRepository.GetDefaultProjectAsync(requestedByUserId, cancellationToken);
                if (otherDefault is not null && otherDefault.Id != existing.Id)
                {
                    otherDefault = otherDefault with { IsDefault = false, UpdatedAt = now };
                    _ = await txRepository.UpdateProjectAsync(otherDefault, tx, cancellationToken);
                }
            }

            return await txRepository.UpdateProjectAsync(existing with
            {
                Name = NormalizeRequired(command.Name),
                Description = NormalizeNullable(command.Description),
                Aliases = NormalizeAliases(command.Aliases),
                Status = ParseStatus(command.Status),
                Color = NormalizeNullable(command.Color),
                Icon = NormalizeNullable(command.Icon),
                IsDefault = command.IsDefault,
                UpdatedAt = now
            }, tx, cancellationToken);
        }, cancellationToken);

        return Map(project);
    }

    public async Task DeleteProjectAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var existing = await repository.GetProjectByIdAsync(projectId, cancellationToken)
            ?? throw new ProjectNotFoundException("Project not found.");

        await repository.DeleteProjectAsync(existing.Id, null, cancellationToken);
    }

    private async Task EnsureUserExistsAsync(Guid userId, CancellationToken cancellationToken)
    {
        _ = await usersRepository.GetUserByIdAsync(userId, null, cancellationToken)
            ?? throw new ProjectValidationException("RequestedByUserId must reference an existing user.");
    }

    private static Guid RequireRequestedByUserId(Guid? requestedByUserId)
        => requestedByUserId ?? throw new ProjectValidationException("RequestedByUserId is required.");

    private static ProjectDto Map(Project project)
        => new(
            project.Id,
            project.RequestedByUserId,
            project.Name,
            project.Description,
            project.Aliases,
            project.Status.ToString().ToLowerInvariant(),
            project.Color,
            project.Icon,
            project.IsDefault,
            project.CreatedAt,
            project.UpdatedAt);

    private static string? NormalizeNullable(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string NormalizeRequired(string value)
        => string.IsNullOrWhiteSpace(value) ? throw new ProjectValidationException("Name is required.") : value.Trim();

    private static IReadOnlyList<string> NormalizeAliases(IReadOnlyList<string>? aliases)
        => aliases is null
            ? Array.Empty<string>()
            : aliases.Select(alias => alias.Trim()).Where(alias => !string.IsNullOrWhiteSpace(alias)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

    private static ProjectStatus ParseStatus(string status)
        => Enum.Parse<ProjectStatus>(status.Trim(), true);
}
