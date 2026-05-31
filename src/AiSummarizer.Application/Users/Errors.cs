namespace AiSummarizer.Application.Users;

public abstract class UsersException : Exception
{
    protected UsersException(string message) : base(message) { }
}

public sealed class UserConflictException : UsersException
{
    public UserConflictException(string message) : base(message) { }
}

public sealed class UserUnauthorizedException : UsersException
{
    public UserUnauthorizedException(string message) : base(message) { }
}

public sealed class UserNotFoundException : UsersException
{
    public UserNotFoundException(string message) : base(message) { }
}
