namespace AiSummarizer.Application.Projects;

public abstract class ProjectsException : Exception
{
    protected ProjectsException(string message) : base(message) { }
}

public sealed class ProjectNotFoundException : ProjectsException
{
    public ProjectNotFoundException(string message) : base(message) { }
}

public sealed class ProjectValidationException : ProjectsException
{
    public ProjectValidationException(string message) : base(message) { }
}

public sealed class ProjectConflictException : ProjectsException
{
    public ProjectConflictException(string message) : base(message) { }
}
