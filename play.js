const storyDataNode = document.getElementById("storyData");
const story = JSON.parse(storyDataNode.textContent);
const sceneRoot = document.getElementById("playScene");
const choicesRoot = document.getElementById("playChoices");
const restartBtn = document.getElementById("restartBtn");

const sceneById = new Map(story.scenes.map((scene) => [scene.id, scene]));

const renderScene = (sceneId) => {
  const scene = sceneById.get(sceneId);

  if (!scene) {
    sceneRoot.innerHTML = `<h2>Missing Scene</h2><p>The scene <strong>${sceneId}</strong> does not exist.</p>`;
    choicesRoot.innerHTML = "";
    return;
  }

  sceneRoot.innerHTML = `
    <h2>${scene.title || scene.id}</h2>
    <p>${(scene.content || "(No content yet.)").replace(/\n/g, "<br />")}</p>
  `;

  if (!scene.choices.length) {
    choicesRoot.innerHTML = "<p><strong>The End.</strong> This path has no further choices.</p>";
    return;
  }

  choicesRoot.innerHTML = "";
  scene.choices.forEach((choice) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = choice.text;
    btn.addEventListener("click", () => renderScene(choice.target));
    choicesRoot.appendChild(btn);
  });
};

restartBtn.addEventListener("click", () => renderScene(story.start_scene));
renderScene(story.start_scene);
