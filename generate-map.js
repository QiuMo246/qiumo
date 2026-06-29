{
  "project": "web-by-claude",

  "frontend": {
    "index.html": "main page",
    "script.js": "ui logic + event handling",
    "styles.css": "global styles"
  },

  "components": {
    "music-player/": "music player module"
  },

  "features": {
    "guestbook": {
      "frontend": "guestbook/",
      "backend": "worker/src/"
    }
  },

  "backend": {
    "worker/": "cloudflare worker api"
  },

  "assets": {
    "music/": "audio resources (ignored in AI logic)"
  },

  "ai_system": {
    "generate-map.js": "auto index generator",
    "generate-diff.js": "git diff extractor",
    "generate-context.js": "ai context builder"
  },

  "rules": {
    "never_load_full_project": true,
    "only_use_diff_or_file": true,
    "ignore_assets": true,
    "ignore_node_modules": true
  }
}