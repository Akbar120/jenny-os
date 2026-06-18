from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class RawLead:
    source_id: str
    source_post_id: str
    source_url: str
    title: str
    body: str
    author: str
    score: int
    raw_text: str  # Combined text fed to MissionBasedLeadHunter

class BaseConnector(ABC):
    @abstractmethod
    def fetch(self, config: dict) -> list[RawLead]:
        """Fetch raw leads from the source. Returns list of RawLead."""
        pass
