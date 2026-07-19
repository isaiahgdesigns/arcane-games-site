# Arcane Games Website

A website built for Arcane Games, a local Magic: The Gathering and Riftbound game shop in Battle Creek, MI. Built as a personal project to explore full-stack concepts using free, static-site-friendly tools.

**Live site:** https://isaiahgdesigns.github.io/arcane-games-site/

## Features

- **Homepage** with shop info, hours, contact, and an auto-updating "tonight's event" feature based on the day of the week
- **Events page** with a weekly schedule, upcoming special events, and game room rental info
- **Live inventory search** for MTG singles and sealed product, pulling from a Google Sheet that's updated via ManaBox exports
- **Automatic card image lookup** via the Scryfall API, matched by exact printing (set + collector number), triggered automatically on edit via Google Apps Script
- **Mobile-responsive** design with a custom nav menu
- **Click-to-enlarge** card images (lightbox)

## Tech stack

- Plain HTML/CSS/JavaScript, no frameworks
- [Papa Parse](https://www.papaparse.com/) for CSV parsing
- [Scryfall API](https://scryfall.com/docs/api) for card data and images
- Google Sheets + Google Apps Script as a lightweight backend for inventory data
- Hosted free on GitHub Pages

## How inventory updates work

1. Cards are scanned into [ManaBox](https://www.manabox.app/), a free collection-tracking app
2. The daily export is pasted into a Google Sheet
3. A custom Apps Script automatically looks up each card's exact printing on Scryfall and fills in its image
4. The site reads the published Sheet live, so changes show up without touching any code

## Status

Currently in progress. Some sections (like the live inventory) show placeholder/demo data while real shop inventory is being prepared.

## Author

Built by Isaiah Gutierrez, [isaiahgdesigns](https://github.com/isaiahgdesigns)