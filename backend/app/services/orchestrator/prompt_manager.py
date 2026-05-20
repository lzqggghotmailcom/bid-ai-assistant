"""
Prompt Manager

Loads and manages prompt templates for the AI bid generation pipeline.
Supports loading from the prompts.py constants file or from a prompts/ directory
with individual template files.
"""

import logging
from pathlib import Path
from typing import Dict

from app.services.orchestrator.prompts import PROMPT_REGISTRY

logger = logging.getLogger(__name__)


class PromptManager:
    """
    Manages prompt template loading, storage, and formatting.

    Templates are loaded from prompts.py constants by default.
    Supports override via a prompts/ directory with .txt template files.
    """

    def __init__(self, prompts_dir: str | None = None):
        """
        Initialize the prompt manager.

        Args:
            prompts_dir: Optional path to a directory containing .txt prompt templates.
                         If provided, templates will be loaded from files there,
                         overriding the built-in constants.
        """
        self._prompts: Dict[str, str] = dict(PROMPT_REGISTRY)
        if prompts_dir:
            self._load_from_directory(prompts_dir)

    def _load_from_directory(self, prompts_dir: str) -> None:
        """
        Load prompt templates from .txt files in the given directory.
        Each .txt filename (without extension) is used as the prompt name.
        """
        dir_path = Path(prompts_dir)
        if not dir_path.is_dir():
            logger.warning("Prompts directory not found: %s", prompts_dir)
            return

        for file_path in dir_path.glob("*.txt"):
            prompt_name = file_path.stem.upper()
            content = file_path.read_text(encoding="utf-8")
            self._prompts[prompt_name] = content
            logger.info("Loaded prompt '%s' from %s (overriding built-in)", prompt_name, file_path)

    def get_prompt(self, name: str) -> str:
        """
        Return the raw prompt template string.

        Args:
            name: The prompt name (e.g. 'P1_PARSE_BID', 'P2_GENERATE_OUTLINE')

        Returns:
            The raw template string with {placeholders} intact.

        Raises:
            KeyError: If the prompt name is not found in the registry.
        """
        name_upper = name.upper()
        if name_upper not in self._prompts:
            available = ", ".join(sorted(self._prompts.keys()))
            raise KeyError(
                f"Prompt '{name}' not found. Available prompts: {available}"
            )
        return self._prompts[name_upper]

    def format_prompt(self, name: str, **kwargs) -> str:
        """
        Format a prompt template by substituting variables.

        Args:
            name: The prompt name (e.g. 'P1_PARSE_BID', 'P4_GENERATE_SECTION')
            **kwargs: Variable values to substitute into the template.

        Returns:
            The formatted prompt string with all variables replaced.

        Raises:
            KeyError: If the prompt name is not found, or if a required
                      placeholder variable is missing from kwargs.
        """
        template = self.get_prompt(name)
        try:
            return template.format(**kwargs)
        except KeyError as e:
            missing_var = str(e).strip("'")
            logger.error(
                "Missing variable '%s' when formatting prompt '%s'. "
                "Provided: %s",
                missing_var, name, list(kwargs.keys()),
            )
            raise KeyError(
                f"Missing required variable '{missing_var}' for prompt '{name}'"
            ) from e

    def list_prompts(self) -> list[str]:
        """Return a sorted list of all registered prompt names."""
        return sorted(self._prompts.keys())

    def register_prompt(self, name: str, template: str) -> None:
        """
        Register (or override) a prompt template at runtime.

        Args:
            name: The prompt name.
            template: The prompt template string.
        """
        self._prompts[name.upper()] = template
        logger.info("Registered prompt '%s'", name.upper())


# Module-level singleton instance
_default_manager: PromptManager | None = None


def get_prompt_manager(prompts_dir: str | None = None) -> PromptManager:
    """
    Get or create the default PromptManager singleton.

    Args:
        prompts_dir: Optional directory path for file-based prompts.

    Returns:
        The PromptManager instance.
    """
    global _default_manager
    if _default_manager is None:
        _default_manager = PromptManager(prompts_dir=prompts_dir)
    return _default_manager


def get_prompt(name: str) -> str:
    """Convenience function: get raw prompt template from the default manager."""
    return get_prompt_manager().get_prompt(name)


def format_prompt(name: str, **kwargs) -> str:
    """Convenience function: format a prompt from the default manager."""
    return get_prompt_manager().format_prompt(name, **kwargs)
