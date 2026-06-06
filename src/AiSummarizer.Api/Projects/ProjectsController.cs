using AiSummarizer.Application.Projects;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Projects;

[ApiController]
[Route("api/projects")]
public sealed class ProjectsController(IProjectsService projectsService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ProjectListResponse>> GetList(
        [FromQuery] Guid? requestedByUserId = null,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
        => Ok(Map(await projectsService.ListProjectsAsync(requestedByUserId, limit, offset, cancellationToken)));

    [HttpGet("{projectId:guid}")]
    public async Task<ActionResult<ProjectResponse>> GetProject([FromRoute] Guid projectId, CancellationToken cancellationToken)
        => Ok(Map(await projectsService.GetProjectAsync(projectId, cancellationToken)));

    [HttpPost]
    public async Task<ActionResult<ProjectResponse>> CreateProject([FromBody] CreateProjectRequest request, CancellationToken cancellationToken)
        => Ok(Map(await projectsService.CreateProjectAsync(new CreateProjectCommand(
            request.RequestedByUserId,
            request.Name,
            request.Description,
            request.Aliases,
            request.Color,
            request.Icon,
            request.IsDefault), cancellationToken)));

    [HttpPut("{projectId:guid}")]
    public async Task<ActionResult<ProjectResponse>> UpdateProject([FromRoute] Guid projectId, [FromBody] UpdateProjectRequest request, CancellationToken cancellationToken)
        => Ok(Map(await projectsService.UpdateProjectAsync(projectId, new UpdateProjectCommand(
            request.Name,
            request.Description,
            request.Aliases,
            request.Status,
            request.Color,
            request.Icon,
            request.IsDefault), cancellationToken)));

    [HttpDelete("{projectId:guid}")]
    public async Task<IActionResult> DeleteProject([FromRoute] Guid projectId, CancellationToken cancellationToken)
    {
        await projectsService.DeleteProjectAsync(projectId, cancellationToken);
        return NoContent();
    }

    private static ProjectListResponse Map(ProjectListDto list)
        => new(list.Projects.Select(Map).ToArray());

    private static ProjectResponse Map(ProjectDto project)
        => new(
            project.Id,
            project.RequestedByUserId,
            project.Name,
            project.Description,
            project.Aliases,
            project.Status,
            project.Color,
            project.Icon,
            project.IsDefault,
            project.CreatedAt,
            project.UpdatedAt);
}
