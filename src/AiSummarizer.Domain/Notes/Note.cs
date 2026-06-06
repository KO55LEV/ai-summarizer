namespace AiSummarizer.Domain.Notes;

public sealed record Note
{
    public Guid Id { get; init; }
    public Guid? RequestedByUserId { get; init; }
    public Guid? ProjectId { get; init; }
    public string Title { get; init; } = string.Empty;
    public NoteStatus Status { get; init; } = NoteStatus.Draft;
    public NoteSourceChannel SourceChannel { get; init; } = NoteSourceChannel.Web;
    public NoteInputKind InputKind { get; init; } = NoteInputKind.Text;
    public string? PrimaryLanguage { get; init; }
    public Guid? CurrentTextVersionId { get; init; }
    public string? Summary { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
