namespace AiSummarizer.Application.Projects;

public sealed record ProjectDto(
    Guid Id,
    Guid? RequestedByUserId,
    string Name,
    string? Description,
    IReadOnlyList<string> Aliases,
    string Status,
    string? Color,
    string? Icon,
    bool IsDefault,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ProjectListDto(
    IReadOnlyList<ProjectDto> Projects);

public sealed record CreateProjectCommand(
    Guid? RequestedByUserId,
    string Name,
    string? Description,
    IReadOnlyList<string>? Aliases,
    string? Color,
    string? Icon,
    bool IsDefault);

public sealed record UpdateProjectCommand(
    string Name,
    string? Description,
    IReadOnlyList<string>? Aliases,
    string Status,
    string? Color,
    string? Icon,
    bool IsDefault);
