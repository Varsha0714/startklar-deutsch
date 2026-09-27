#!/bin/sh
# Builds two copies from src/:
#   startklar.html  - Claude artifact version (the artifact viewer supplies the <html>/<head> skeleton)
#   index.html      - standalone website for GitHub Pages (progress is saved in the browser)
cd "$(dirname "$0")"
head() {
  cat src/01-head.html
  echo '<style>[hidden]{display:none!important}</style>'
}
body() {
  echo '<div id="app"></div>'
  echo '<div id="runner" class="runner" hidden></div>'
  echo '<script>'
  cat src/02-vocab.js src/03-exercises.js src/04-core.js src/05-runner.js src/06-screens.js
  echo '</script>'
}
{ head; body; } > startklar.html
{
  echo '<!doctype html>'
  echo '<html lang="de">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<meta name="description" content="Practice for the Goethe A1 and A2 German exams: listening, vocabulary, reading, writing and speaking, with a plan that adapts to your weak spots.">'
  echo '<meta name="theme-color" content="#2743C9">'
  echo '<link rel="icon" href="icon.svg" type="image/svg+xml">'
  echo '<link rel="apple-touch-icon" href="apple-touch-icon.png">'
  echo '<link rel="manifest" href="manifest.webmanifest">'
  echo '<style>html{padding-top:env(safe-area-inset-top,0px)}body{margin:0}img{max-width:100%}</style>'
  head
  echo '</head>'
  echo '<body>'
  body
  echo '</body>'
  echo '</html>'
} > index.html
