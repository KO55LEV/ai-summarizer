alter table note_text_versions
    add column if not exists source_asset_id uuid null references note_assets(id) on delete set null;

create index if not exists ix_note_text_versions_source_asset
    on note_text_versions (source_asset_id);

alter table note_processing_runs
    add column if not exists source_asset_id uuid null references note_assets(id) on delete set null;

create index if not exists ix_note_processing_runs_source_asset
    on note_processing_runs (source_asset_id);
