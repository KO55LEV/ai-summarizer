namespace AiSummarizer.Application.Notes;

public abstract class NotesException : Exception
{
    protected NotesException(string message) : base(message) { }
}

public sealed class NoteNotFoundException : NotesException
{
    public NoteNotFoundException(string message) : base(message) { }
}

public sealed class NoteValidationException : NotesException
{
    public NoteValidationException(string message) : base(message) { }
}

public sealed class NoteConflictException : NotesException
{
    public NoteConflictException(string message) : base(message) { }
}
