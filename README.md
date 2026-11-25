# DRAFTORA — CV & Banner Maker

DRAFTORA is a free, no-sign-up resume builder and banner/graphics maker. It's built entirely as a **Claude Artifacts "Design" canvas** — an interactive, multi-artboard prototype made of Design Component (`.dc.html`) files — rather than as a conventional coded web app with a build step.

## What it does

- **150 resume templates** across five visually distinct styles — Modern, Minimal, Creative, Executive, and Professional — each with its own gallery card and full-size preview design.
- **250 banner templates** for social posts, LinkedIn banners, event flyers, sale promos, and quote cards.
- **Live resume editor** with:
  - A dual **Completion** and **Content Quality** scoring system that updates as you type, with section-by-section feedback (contact info, summary, experience, education, skills).
  - Optional profile photo upload (drag/select an image, preview it inline, remove it).
  - A live preview panel that shows exactly how the resume will look when opened to edit or downloaded.
  - Three layout variants (Classic, Profile, Sidebar) and six accent colors.
- **Banner editor** with image upload, color-pair themes, and three layout variants (Centered, Left text, Top badge).
- **MR.DRAFTORA**, an in-app assistant chatbot that answers questions about:
  - What matters most on a resume in today's job market, and what ATS systems look for.
  - What HR and recruiters are actually looking for.
  - Field-specific certifications and skills for Finance, Marketing, IT/Technical, and future-proofing a career.
  - Live, personalized suggestions on what to improve, pulled directly from the resume editor's scoring feedback.
- **Dedicated mobile layouts** for every page (Home, Templates, Editor, Banners, Banner Editor).

## How this project is structured

Everything lives under [`project/`](./project):

| File | Purpose |
|---|---|
| `Main.dc.html` / `Main-Phone.dc.html` | Home page |
| `Templates.dc.html` / `Templates-Phone.dc.html` | Resume template gallery (150 templates) |
| `Editor.dc.html` / `Editor-Phone.dc.html` | Resume editor with live CV scoring |
| `Banners.dc.html` / `Banners-Phone.dc.html` | Banner template gallery (250 templates) |
| `BannerEditor.dc.html` / `BannerEditor-Phone.dc.html` | Banner editor |
| `ChatBot.dc.html` | MR.DRAFTORA, the shared assistant widget imported across pages |
| `canvas.json` | The artboard index — positions, sizes, and z-order for every page on the canvas |

Each `.dc.html` file is a **Design Component**: a small, self-contained unit with its own markup, styles, and a `Component extends DCLogic` class that holds state and renders bindings (`{{like_this}}`). Pages communicate through props (for example, the Editor passes its live CV feedback into the ChatBot via a `cv-tips` prop).

## Best way to view this project

This project is authored and best experienced as a **Claude Artifact** (a Design-type canvas), where all the pages, interactivity, and the floating chatbot render live and are directly editable. Viewing the raw `.dc.html` files as static HTML outside that environment will not run the interactive logic or wire the pages together — treat this repository as the source/export of that canvas rather than a deployable static site.
