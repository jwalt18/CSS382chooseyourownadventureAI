from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
STORIES_DIR = BASE_DIR / "data" / "stories"
STORIES_DIR.mkdir(parents=True, exist_ok=True)


class StoryValidationError(ValueError):
    """Raised when story payload is invalid."""


def _story_file(story_id: str) -> Path:
    return STORIES_DIR / f"{story_id}.json"


def _load_story(story_id: str) -> dict[str, Any] | None:
    path = _story_file(story_id)
    if not path.exists():
        return None

    with path.open("r", encoding="utf-8") as fp:
        return json.load(fp)


def _validate_story_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise StoryValidationError("Payload must be a JSON object.")

    title = payload.get("title", "").strip()
    if not title:
        raise StoryValidationError("A story title is required.")

    scenes = payload.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        raise StoryValidationError("At least one scene is required.")

    normalized_scenes: list[dict[str, Any]] = []
    scene_ids: set[str] = set()

    for idx, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            raise StoryValidationError(f"Scene #{idx + 1} must be an object.")

        scene_id = str(scene.get("id", "")).strip()
        if not scene_id:
            raise StoryValidationError(f"Scene #{idx + 1} is missing an id.")
        if scene_id in scene_ids:
            raise StoryValidationError(f"Duplicate scene id found: {scene_id}.")

        scene_ids.add(scene_id)

        scene_title = str(scene.get("title", "")).strip() or f"Scene {idx + 1}"
        content = str(scene.get("content", "")).strip()
        choices = scene.get("choices", [])

        if not isinstance(choices, list):
            raise StoryValidationError(f"Scene '{scene_id}' choices must be a list.")

        normalized_choices: list[dict[str, str]] = []
        for choice_idx, choice in enumerate(choices):
            if not isinstance(choice, dict):
                raise StoryValidationError(
                    f"Scene '{scene_id}' choice #{choice_idx + 1} must be an object."
                )

            choice_text = str(choice.get("text", "")).strip()
            target = str(choice.get("target", "")).strip()

            if not choice_text:
                raise StoryValidationError(
                    f"Scene '{scene_id}' has a choice without text."
                )
            if not target:
                raise StoryValidationError(
                    f"Scene '{scene_id}' has a choice without target."
                )

            normalized_choices.append({"text": choice_text, "target": target})

        normalized_scenes.append(
            {
                "id": scene_id,
                "title": scene_title,
                "content": content,
                "choices": normalized_choices,
            }
        )

    start_scene = str(payload.get("start_scene", "")).strip() or normalized_scenes[0]["id"]
    if start_scene not in scene_ids:
        raise StoryValidationError("The start_scene must match one of the scene ids.")

    for scene in normalized_scenes:
        for choice in scene["choices"]:
            if choice["target"] not in scene_ids:
                raise StoryValidationError(
                    f"Choice in scene '{scene['id']}' points to missing target "
                    f"'{choice['target']}'."
                )

    return {
        "title": title,
        "description": str(payload.get("description", "")).strip(),
        "author": str(payload.get("author", "")).strip(),
        "start_scene": start_scene,
        "scenes": normalized_scenes,
    }


def _save_story(story: dict[str, Any], story_id: str | None = None) -> dict[str, Any]:
    validated = _validate_story_payload(story)
    now = datetime.now(timezone.utc).isoformat()

    if story_id:
        validated["id"] = story_id
        existing = _load_story(story_id)
        validated["created_at"] = (existing or {}).get("created_at", now)
    else:
        validated["id"] = uuid.uuid4().hex[:8]
        validated["created_at"] = now

    validated["updated_at"] = now

    path = _story_file(validated["id"])
    with path.open("w", encoding="utf-8") as fp:
        json.dump(validated, fp, indent=2)

    return validated


@app.get("/")
def index() -> str:
    return render_template("index.html")


@app.get("/play/<story_id>")
def play_story(story_id: str):
    story = _load_story(story_id)
    if story is None:
        return render_template("not_found.html", story_id=story_id), 404

    return render_template("play.html", story=story)


@app.get("/api/stories")
def list_stories():
    stories: list[dict[str, Any]] = []
    for path in sorted(STORIES_DIR.glob("*.json")):
        with path.open("r", encoding="utf-8") as fp:
            story = json.load(fp)
        stories.append(
            {
                "id": story.get("id"),
                "title": story.get("title", "Untitled"),
                "author": story.get("author", ""),
                "updated_at": story.get("updated_at"),
                "scene_count": len(story.get("scenes", [])),
            }
        )

    return jsonify(stories)


@app.get("/api/stories/<story_id>")
def get_story(story_id: str):
    story = _load_story(story_id)
    if story is None:
        return jsonify({"error": "Story not found."}), 404

    return jsonify(story)


@app.post("/api/stories")
def create_story():
    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Expected JSON body."}), 400

    try:
        saved = _save_story(payload)
    except StoryValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(saved), 201


@app.put("/api/stories/<story_id>")
def update_story(story_id: str):
    if _load_story(story_id) is None:
        return jsonify({"error": "Story not found."}), 404

    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Expected JSON body."}), 400

    try:
        saved = _save_story(payload, story_id=story_id)
    except StoryValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(saved)


@app.post("/api/import")
def import_story():
    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Expected JSON body."}), 400

    payload.pop("id", None)
    payload.pop("created_at", None)
    payload.pop("updated_at", None)

    try:
        saved = _save_story(payload)
    except StoryValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(saved), 201


if __name__ == "__main__":
    app.run(debug=True)
