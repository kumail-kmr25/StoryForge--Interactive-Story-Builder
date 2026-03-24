# 📖 StoryForge — Interactive Story Builder

> A premium, browser-based interactive fiction authoring tool for writers, game designers, and creative minds.

![StoryForge](https://img.shields.io/badge/StoryForge-v1.0-blueviolet?style=for-the-badge)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

---

## 🌟 Overview

**StoryForge** is a fully client-side interactive story builder that lets you craft branching narratives with multiple paths, choices, and endings. Design your story visually, connect nodes with choices, preview the branching flow on a visual map, and play through your creation — all within a cinematic, theme-aware interface.

No frameworks. No backend. Just pure HTML, CSS, and vanilla JavaScript.

---

## ✨ Features

### 🏗️ Story Creation
- Create stories with titles, descriptions, and immersive themes
- Three atmospheric themes: **Dark Fantasy**, **Sci-Fi**, and **Mystery**
- Each theme transforms the entire UI with unique colors, gradients, and mood

### 📝 Node Editor
- Create unlimited story nodes with rich scene descriptions
- Node types: **Start**, **Normal**, and **Ending**
- Ending subtypes: Good, Bad, Secret, and Neutral endings
- Edit and delete nodes with safeguards (start node protection)
- Visual indicators for node types

### 🔀 Branching Choices
- Add multiple choices per node
- Link choices to any existing node
- Real-time validation for broken links
- Warning system for unlinked or orphaned nodes
- Prevents broken story flow

### 🗺️ Visual Path Map
- Auto-generated visual story map
- Nodes displayed as connected cards with directional arrows
- Color-coded by type (start, normal, ending)
- Highlights active node during editing
- Tree-based hierarchical layout algorithm

### 🎮 Play Mode
- Play through stories from the start node
- Scrollable play history showing your journey
- Ending celebrations with type-specific messages
- Restart and replay at any time
- Play progress saved automatically

### 💾 Save & Export
- Auto-save to localStorage on every change
- Manual save/load of multiple stories
- Export stories as JSON files
- Import JSON story files
- Full story library management

### 🎨 Design
- Glassmorphism panels with soft shadows
- Rich gradients and atmospheric backgrounds
- Smooth transitions and hover animations
- Fully responsive design (mobile, tablet, desktop)
- Premium UI that feels like a real product

---

## 🚀 Getting Started

### Quick Start
1. Clone or download this repository
2. Open `index.html` in any modern browser
3. Start creating your story!

```bash
# Clone the repository
git clone https://github.com/yourusername/storyforge.git

# Navigate to the project
cd storyforge

# Open in browser (macOS)
open index.html

# Open in browser (Linux)
xdg-open index.html

# Open in browser (Windows)
start index.html
```

### Using a Local Server (Optional)
```bash
# Python 3
python -m http.server 8000

# Node.js (if npx available)
npx serve .
```

---

## 📁 Project Structure

```
storyforge/
├── index.html      # Main HTML structure & semantic markup
├── style.css       # Complete styling with themes & animations
├── script.js       # Application logic, data management, rendering
└── README.md       # Project documentation
```

---

## 🎯 How to Use

### 1. Create a Story
- Click **"New Story"** in the sidebar
- Enter a title and description
- Select an atmospheric theme
- Click **"Create Story"**

### 2. Build Nodes
- Click **"Add Node"** in the Node Editor
- Give it a title and write the scene description
- Set the node type (Start, Normal, or Ending)
- For endings, choose the ending type

### 3. Connect with Choices
- Select a node to edit
- Add choices with descriptive text
- Link each choice to a target node
- The visual map updates in real-time

### 4. Preview the Map
- Switch to the **"Path Map"** tab
- See your entire story structure visualized
- Identify orphaned nodes or broken links

### 5. Play Your Story
- Switch to the **"Play"** tab
- Experience your story as a reader would
- Make choices and see where they lead
- Reach different endings based on your path

### 6. Save & Share
- Stories auto-save to localStorage
- Export as JSON to share with others
- Import JSON files to load shared stories

---

## 🎨 Themes

| Theme | Mood | Colors |
|-------|------|--------|
| 🗡️ **Dark Fantasy** | Medieval, mystical, ominous | Deep purples, golds, dark gradients |
| 🚀 **Sci-Fi** | Futuristic, neon, cyberpunk | Cyan, electric blue, dark metallics |
| 🔍 **Mystery** | Noir, suspenseful, shadowy | Deep greens, amber, foggy grays |

---

## 🧠 Data Structure

```javascript
{
  id: "story_1234567890",
  title: "The Lost Kingdom",
  description: "A tale of forgotten realms...",
  theme: "dark-fantasy",
  createdAt: "2024-01-15T10:30:00.000Z",
  updatedAt: "2024-01-15T12:45:00.000Z",
  nodes: [
    {
      id: "node_001",
      title: "The Beginning",
      text: "You stand at the castle gates...",
      type: "start",
      endingType: null,
      choices: [
        { id: "ch_001", text: "Enter the castle", targetNodeId: "node_002" },
        { id: "ch_002", text: "Explore the forest", targetNodeId: "node_003" }
      ]
    }
  ]
}
```

---

## 🛠️ Technical Details

- **Storage**: localStorage (no backend required)
- **Rendering**: Dynamic DOM manipulation
- **Layout**: CSS Grid + Flexbox
- **Animations**: CSS transitions + keyframes
- **Map Rendering**: Canvas API for connectors + HTML nodes
- **Responsive**: Mobile-first with breakpoints at 768px and 1024px

---

## 📱 Browser Support

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Full |
| Firefox 88+ | ✅ Full |
| Safari 14+ | ✅ Full |
| Edge 90+ | ✅ Full |

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- Built as a portfolio project demonstrating advanced vanilla JavaScript
- Inspired by interactive fiction tools like Twine, Inklewriter, and ChoiceScript
- Designed with love for storytellers and game designers

---

<p align="center">
  <strong>StoryForge</strong> — Where every choice matters. ✨
</p>
