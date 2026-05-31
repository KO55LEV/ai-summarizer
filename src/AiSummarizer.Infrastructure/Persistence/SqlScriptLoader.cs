namespace AiSummarizer.Infrastructure.Persistence;

public interface ISqlScriptLoader
{
    string Load(string relativePath);
}

public sealed class FileSqlScriptLoader : ISqlScriptLoader
{
    public string Load(string relativePath)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Sql", relativePath);
        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"SQL script not found: {relativePath}", path);
        }

        return File.ReadAllText(path);
    }
}
