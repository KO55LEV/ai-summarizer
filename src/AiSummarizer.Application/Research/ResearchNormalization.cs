namespace AiSummarizer.Application.Research;

public sealed record ResearchDocumentDto(
    Guid Id,
    Guid ResearchContentItemId,
    Guid ResearchTopicRunId,
    Guid ResearchTopicId,
    string SourceKey,
    string CanonicalUrl,
    string Title,
    string? AuthorName,
    DateTimeOffset? PublishedAt,
    DateTimeOffset NormalizedAt,
    string CanonicalBody,
    string CanonicalHash,
    string RawContentHash,
    string SourceProvenanceJson,
    string NormalizerVersion,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchDocumentRecord(
    Guid Id,
    Guid ResearchContentItemId,
    Guid ResearchTopicRunId,
    Guid ResearchTopicId,
    string SourceKey,
    string CanonicalUrl,
    string Title,
    string? AuthorName,
    DateTimeOffset? PublishedAt,
    DateTimeOffset NormalizedAt,
    string CanonicalBody,
    string CanonicalHash,
    string RawContentHash,
    string SourceProvenanceJson,
    string NormalizerVersion,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchDocumentChunkDto(
    Guid Id,
    Guid ResearchDocumentId,
    int ChunkIndex,
    string? ChunkTitle,
    string ChunkText,
    int TokenCount,
    int StartOffset,
    int EndOffset,
    string ChunkHash,
    string ChunkMetadataJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ResearchDocumentChunkRecord(
    Guid Id,
    Guid ResearchDocumentId,
    int ChunkIndex,
    string? ChunkTitle,
    string ChunkText,
    int TokenCount,
    int StartOffset,
    int EndOffset,
    string ChunkHash,
    string ChunkMetadataJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
