<script setup>
definePageMeta({
  middleware: 'teacher-auth',
})

await navigateTo(
  '/teacher',
  {
    replace: true,
  },
)
</script>

<template>
  <main class="redirect-page">
    <p>
      請假現在直接在學生頁面處理，正在返回學生管理...
    </p>
  </main>
</template>

<style scoped>
.redirect-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #f6f6f6;
  color: #999999;
  font-size: 10px;
  text-align: center;
}
</style>