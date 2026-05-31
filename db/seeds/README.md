# Seeds

These SQL files are for manual bootstrap and test data.

Each file has a small editable config block in the `params` CTE. Change the values directly in the file, then copy-paste and run it.

## Test user

`0001_seed_test_user.sql` creates or updates a single test user.

Parameters:

- `user_id` - optional UUID to make the seed deterministic
- `user_email` - required, default `test@test.com`
- `display_name` - optional, default `Test User`

## YouTube download job

`0002_seed_youtube_download_job.sql` creates a queued `youtube.download` job.

Parameters:

- `requested_by_user_id` - optional UUID, defaults to null
- `youtube_url` - required, default `https://www.youtube.com/watch?v=VIDEO_ID`
- `job_id` - optional UUID
- `priority` - optional, default `0`
- `custom_file_name` - optional
- `output_directory` - optional, default `./downloads/youtube`
- `max_attempts` - optional, default `3`

### Example

```bash
-- edit the values in db/seeds/0001_seed_test_user.sql and run it
```

For the job seed, edit the URL in the file:

```bash
-- edit the values in db/seeds/0002_seed_youtube_download_job.sql and run it
```

## Audio extraction job

`0003_seed_media_extract_audio_job.sql` creates a queued `media.extract_audio` job from the previous downloaded video.

It uses the last `youtube.download` job row as the source and pulls `outputFilePath` from `result_json`.

Current hardcoded fixture values:

- source job id: `26077d03-195d-4b30-b60a-12797926cdfb`
- requested by user id: `617a8af2-bae2-43a6-938f-7c384e3061ee`
- output directory: `/Volumes/Data/AiSummary/Audio`
- audio format: `m4a`

```bash
-- edit the values in db/seeds/0003_seed_media_extract_audio_job.sql and run it
```

## Whisper transcription job

`0004_seed_whisper_transcribe_job.sql` creates a queued `whisper.transcribe` job from the extracted audio file.

Current hardcoded fixture values:

- source job id: `5a61c985-573c-4b82-a813-e957d434f61b`
- requested by user id: `617a8af2-bae2-43a6-938f-7c384e3061ee`
- output directory: `/Volumes/Data/AiSummary/Transcripts`

```bash
-- edit the values in db/seeds/0004_seed_whisper_transcribe_job.sql and run it
```

## Whisper transcription job for current audio

`0005_seed_whisper_transcribe_current_audio.sql` is the ready-to-run seed for the audio file that was already extracted in the previous job.

Current hardcoded fixture values:

- source job id: `5a61c985-573c-4b82-a813-e957d434f61b`
- requested by user id: `617a8af2-bae2-43a6-938f-7c384e3061ee`
- output directory: `/Volumes/Data/AiSummary/Transcripts`

```bash
-- edit the values in db/seeds/0005_seed_whisper_transcribe_current_audio.sql and run it
```

## Transcript import job

`0006_seed_transcript_import_job.sql` creates a queued `transcript.import` job for the transcript JSON file that already exists on disk.

Current hardcoded fixture values:

- source job id: `a02a7e94-1320-41c3-8dda-2058fc1617ee`
- requested by user id: `617a8af2-bae2-43a6-938f-7c384e3061ee`
- transcript file path: `/Volumes/Data/AiSummary/Transcripts/a02a7e94132041c38dda2058fc1617ee/Маргулан Сейсембай про ИИ, инвестиции и личный бренд | Как не проиграть в 2026 году?.json`
- source audio file path: `/Volumes/Data/AiSummary/Audio/5a61c985573c4b82a813e957d434f61b/Маргулан Сейсембай про ИИ, инвестиции и личный бренд | Как не проиграть в 2026 году?.m4a`

```bash
-- edit the values in db/seeds/0006_seed_transcript_import_job.sql and run it
```
