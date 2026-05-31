using Npgsql;

namespace AiSummarizer.Infrastructure.Persistence;

public sealed class DbConnectionFactory(NpgsqlDataSource dataSource)
{
    public NpgsqlDataSource DataSource { get; } = dataSource;
}
