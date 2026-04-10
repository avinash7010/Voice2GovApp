"""Speech-to-text service for uploaded voice files."""
import logging
from pathlib import Path

from pydub import AudioSegment
from starlette.concurrency import run_in_threadpool

from app.services.ai_service import vosk_stt


logger = logging.getLogger(__name__)


class TranscriptionService:
    """Handles audio file transcription with a local lightweight pipeline."""

    @staticmethod
    def _transcribe_sync(file_path: Path) -> str:
        if not file_path.exists():
            raise FileNotFoundError(f"Audio file not found: {file_path}")

        audio = AudioSegment.from_file(file_path)
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        raw_data = audio.raw_data

        logger.debug("audio.raw_data length: %d", len(raw_data))
        logger.debug("audio.raw_data first 100 bytes: %s", raw_data[:100])

        if len(raw_data) < 20000:
            raise ValueError("Audio too short to transcribe")

        text = vosk_stt.transcribe(raw_data, sample_rate=16000).strip()
        if not text:
            raise ValueError("Transcription returned empty text")

        return text

    async def transcribe_file(self, file_path: Path) -> str:
        """Convert a saved audio file into text."""
        try:
            return await run_in_threadpool(self._transcribe_sync, file_path)
        except Exception as exc:
            logger.exception("Failed to transcribe audio file: %s", file_path)
            raise RuntimeError(f"Transcription failed: {exc}") from exc


transcription_service = TranscriptionService()
