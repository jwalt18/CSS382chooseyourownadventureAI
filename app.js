const sceneTemplate = document.getElementById("sceneTemplate");
const choiceTemplate = document.getElementById("choiceTemplate");
const sceneList = document.getElementById("sceneList");
const statusEl = document.getElementById("status");
const savedStoriesEl = document.getElementById("savedStories");
const playLinkBox = document.getElementById("playLinkBox");
const playLink = document.getElementById("playLink");

let currentStoryId = null;

const setStatus = (text, isError = false) => {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#8a1b1b" : "#2f7766";
};

const makeSceneCard = (scene = null, makeStart = false) => {
  const card = sceneTemplate.content.firstElementChild.cloneNode(true);
  const idInput = card.querySelector(".scene-id");
  const titleInput = card.querySelector(".scene-title");
  const contentInput = card.querySelector(".scene-content");
  const choiceList = card.querySelector(".choice-list");
  const startRadio = card.querySelector(".start-scene");
  const sceneLabel = card.querySelector(".scene-label");

  idInput.value = scene?.id || `scene_${crypto.randomUUID().slice(0, 6)}`;
  titleInput.value = scene?.title || "";
  contentInput.value = scene?.content || "";
  startRadio.checked = !!makeStart;

  const updateLabel = () => {
    sceneLabel.textContent = idInput.value || "Untitled Scene";
  };

  idInput.addEventListener("input", updateLabel);
  updateLabel();

  const addChoice = (choice = null) => {
    const row = choiceTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector(".choice-text").value = choice?.text || "";
    row.querySelector(".choice-target").value = choice?.target || "";
    row.querySelector(".delete-choice").addEventListener("click", () => row.remove());
    choiceList.appendChild(row);
  };

  (scene?.choices || []).forEach((choice) => addChoice(choice));

  card.querySelector(".add-choice").addEventListener("click", () => addChoice());
  card.querySelector(".delete-scene").addEventListener("click", () => card.remove());

  return card;
};

const gatherStoryFromUI = () => {
  const scenes = [...sceneList.querySelectorAll(".scene-card")].map((card) => {
    const choices = [...card.querySelectorAll(".choice-row")].map((row) => ({
      text: row.querySelector(".choice-text").value.trim(),
      target: row.querySelector(".choice-target").value.trim(),
    }));

    return {
      id: card.querySelector(".scene-id").value.trim(),
      title: card.querySelector(".scene-title").value.trim(),
      content: card.querySelector(".scene-content").value.trim(),
      choices,
      isStart: card.querySelector(".start-scene").checked,
    };
  });

  const startScene = scenes.find((scene) => scene.isStart)?.id || scenes[0]?.id || "";

  return {
    title: document.getElementById("storyTitle").value.trim(),
    author: document.getElementById("storyAuthor").value.trim(),
    description: document.getElementById("storyDescription").value.trim(),
    start_scene: startScene,
    scenes: scenes.map(({ isStart, ...scene }) => scene),
  };
};

const populateStoryInUI = (story) => {
  currentStoryId = story.id;
  document.getElementById("storyTitle").value = story.title || "";
  document.getElementById("storyAuthor").value = story.author || "";
  document.getElementById("storyDescription").value = story.description || "";

  sceneList.innerHTML = "";
  story.scenes.forEach((scene) => {
    sceneList.appendChild(makeSceneCard(scene, scene.id === story.start_scene));
  });

  showPlayLink(story.id);
};

const showPlayLink = (storyId) => {
  playLink.href = `/play/${storyId}`;
  playLink.textContent = `${window.location.origin}/play/${storyId}`;
  playLinkBox.classList.remove("hidden");
};

const refreshStoryList = async () => {
  const res = await fetch("/api/stories");
  const stories = await res.json();

  savedStoriesEl.innerHTML = '<option value="">Choose a saved story...</option>';

  stories.forEach((story) => {
    const opt = document.createElement("option");
    opt.value = story.id;
    opt.textContent = `${story.title} (${story.scene_count} scenes)`;
    savedStoriesEl.appendChild(opt);
  });
};

document.getElementById("newSceneBtn").addEventListener("click", () => {
  sceneList.appendChild(makeSceneCard(null, sceneList.children.length === 0));
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  const payload = gatherStoryFromUI();

  try {
    const url = currentStoryId ? `/api/stories/${currentStoryId}` : "/api/stories";
    const method = currentStoryId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Could not save story.");
    }

    currentStoryId = data.id;
    setStatus("Story saved successfully.");
    showPlayLink(data.id);
    await refreshStoryList();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById("loadBtn").addEventListener("click", async () => {
  const storyId = savedStoriesEl.value;
  if (!storyId) {
    setStatus("Choose a story to load.", true);
    return;
  }

  try {
    const res = await fetch(`/api/stories/${storyId}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Could not load story.");
    }

    populateStoryInUI(data);
    setStatus("Story loaded.");
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const payload = gatherStoryFromUI();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(payload.title || "story").replace(/\s+/g, "_").toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importBtn").addEventListener("click", async () => {
  const raw = document.getElementById("importJson").value.trim();
  if (!raw) {
    setStatus("Paste JSON into the import box first.", true);
    return;
  }

  try {
    const json = JSON.parse(raw);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Import failed.");
    }

    populateStoryInUI(data);
    await refreshStoryList();
    setStatus("Story imported and saved.");
  } catch (err) {
    setStatus(err.message, true);
  }
});

sceneList.appendChild(makeSceneCard(null, true));
refreshStoryList();
