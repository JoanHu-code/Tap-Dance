<template>
  <div>
    <slot />
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}

html,
body,
#__nuxt {
  min-height: 100%;
  margin: 0;
}

body {
  margin: 0;
  color: #222222;
  background: #f7f7f7;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    "Noto Sans TC",
    sans-serif;
}

button,
input,
textarea,
select {
  font: inherit;
}
</style>