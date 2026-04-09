# Adventure Forge (Choose Your Own Adventure Maker)

Adventure Forge is a Python + Flask website for creating and playing choose-your-own-adventure stories in any web browser.

## Features

- Build branching stories with scenes and choices
- Set a start scene and connect paths by scene id
- Save stories on the server
- Load existing stories for editing
- Export stories as JSON
- Import stories from JSON
- Open a playable story link for readers

## Run Locally

1. Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Start the app:

```bash
python app.py
```

4. Open in your browser:

```text
http://127.0.0.1:5000
```

## Story Data

Saved stories are stored as JSON files in `data/stories/`.
