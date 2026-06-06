using System.Data.Common;
using AiSummarizer.Domain.Projects;

namespace AiSummarizer.Application.Projects;

public interface IProjectsRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<IProjectsRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<Project?> GetProjectByIdAsync(Guid projectId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Project>> ListProjectsAsync(Guid? requestedByUserId, int limit, int offset, CancellationToken cancellationToken);
    Task<Project?> GetDefaultProjectAsync(Guid? requestedByUserId, CancellationToken cancellationToken);
    Task<Project> CreateProjectAsync(Project project, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Project> UpdateProjectAsync(Project project, DbTransaction? transaction, CancellationToken cancellationToken);
    Task DeleteProjectAsync(Guid projectId, DbTransaction? transaction, CancellationToken cancellationToken);
}

public interface IProjectsService
{
    Task<ProjectListDto> ListProjectsAsync(Guid? requestedByUserId, int limit, int offset, CancellationToken cancellationToken);
    Task<ProjectDto> GetProjectAsync(Guid projectId, CancellationToken cancellationToken);
    Task<ProjectDto> CreateProjectAsync(CreateProjectCommand command, CancellationToken cancellationToken);
    Task<ProjectDto> UpdateProjectAsync(Guid projectId, UpdateProjectCommand command, CancellationToken cancellationToken);
    Task DeleteProjectAsync(Guid projectId, CancellationToken cancellationToken);
}
