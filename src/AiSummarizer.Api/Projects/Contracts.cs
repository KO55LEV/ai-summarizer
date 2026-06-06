namespace AiSummarizer.Api.Projects;

public sealed record CreateProjectRequest(
    Guid? RequestedByUserId,
    string Name,
    string? Description,
    IReadOnlyList<string>? Aliases,
    string? Color,
    string? Icon,
    bool IsDefault);

public sealed record UpdateProjectRequest(
    string Name,
    string? Description,
    IReadOnlyList<string>? Aliases,
    string Status,
    string? Color,
    string? Icon,
    bool IsDefault);

public sealed record ProjectResponse(
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

public sealed record ProjectListResponse(
    IReadOnlyList<ProjectResponse> Projects);
